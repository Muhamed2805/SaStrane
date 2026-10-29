import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/auth/email.service';
import { ROTATION_GRACE_MS } from '../src/auth/sessions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { contractCheckedRequest } from './openapi-contract';
import {
  CapturingEmailService,
  PASSWORD,
  cookiePair,
  createUser,
  resetDatabase,
  setCookieHeader,
} from './helpers';

// The app runs with its real configuration against the e2e database. Only
// email delivery and the rate limiter's storage are swapped out. Every
// response must match openapi.json.

// The app's real in-memory rate limiter, swapped for a fresh one before each
// test. Otherwise limits such as the login one run out across tests.
class ResettableThrottlerStorage implements ThrottlerStorage {
  private current = new ThrottlerStorageService();

  increment(...args: Parameters<ThrottlerStorage['increment']>) {
    return this.current.increment(...args);
  }

  reset() {
    this.current.onApplicationShutdown();
    this.current = new ThrottlerStorageService();
  }
}

const listingInput = {
  title: 'Košenje dvorišta i orezivanje živice',
  category: 'Košenje trave',
  location: 'Ilidža',
  budget: '60 KM',
  description: 'Dvorište od oko 400 m², kosilicu imam.',
};

describe('App (e2e)', () => {
  const throttlerStorage = new ResettableThrottlerStorage();
  const emails = new CapturingEmailService();
  const contractViolations: string[] = [];
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emails)
      .overrideProvider(ThrottlerStorage)
      .useValue(throttlerStorage)
      .compile();

    app = configureApp(
      moduleFixture.createNestApplication<NestExpressApplication>(),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    emails.clear();
    throttlerStorage.reset();
  });

  afterEach(() => {
    expect(contractViolations.splice(0)).toEqual([]);
  });

  const http = () =>
    contractCheckedRequest(app.getHttpServer(), contractViolations);

  async function login(email: string, password = PASSWORD) {
    const response = await http()
      .post('/api/auth/login')
      .set('User-Agent', 'e2e-browser')
      .send({ email, password })
      .expect(200);

    return {
      response,
      accessToken: (response.body as { accessToken: string }).accessToken,
      cookie: cookiePair(setCookieHeader(response)),
    };
  }

  // A verified user and their access token.
  async function signedInUser(fullName?: string) {
    const user = await createUser(prisma, { fullName });
    const { accessToken } = await login(user.email);
    return { user, auth: `Bearer ${accessToken}` };
  }

  function refresh(cookie?: string) {
    const call = http().post('/api/auth/refresh');
    return cookie ? call.set('Cookie', cookie) : call;
  }

  function me(accessToken: string) {
    return http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  async function postListing(auth: string, input: object = listingInput) {
    const response = await http()
      .post('/api/listings')
      .set('Authorization', auth)
      .send(input)
      .expect(201);
    return response.body as { id: string };
  }

  describe('routing', () => {
    it('GET /health reports a reachable database', async () => {
      const response = await http().get('/health').expect(200);

      expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    });

    it('serves the API only under /api', async () => {
      await http().get('/').expect(404);
      await http().get('/auth/me').expect(404);
      await http().get('/api/health').expect(404);
    });
  });

  describe('sign-up and email codes', () => {
    const registration = {
      email: 'New.User@Example.com',
      password: PASSWORD,
      fullName: 'New User',
      role: 'BOTH',
    };

    it('rejects unknown fields in a request body', async () => {
      await http()
        .post('/api/auth/register')
        .send({ ...registration, isAdmin: true })
        .expect(400);

      expect(await prisma.user.count()).toBe(0);
    });

    it('rejects passwords that bcrypt would silently truncate', async () => {
      const response = await http()
        .post('/api/auth/register')
        .send({ ...registration, password: 'a'.repeat(73) })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('Lozinka je preduga');
    });

    it('signs in only after the emailed code confirms the address', async () => {
      await http().post('/api/auth/register').send(registration).expect(201);
      const email = 'new.user@example.com';

      const early = await http()
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(403);
      expect(early.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

      await http()
        .post('/api/auth/verify-email')
        .send({ email, code: '000000' })
        .expect(400);

      const verified = await http()
        .post('/api/auth/verify-email')
        .send({ email, code: emails.lastCode('verification', email) })
        .expect(200);
      expect(verified.body).toMatchObject({ user: { email } });
      setCookieHeader(verified);

      await login(email);
    });

    it('creates one account when two sign-ups with one email race', async () => {
      const statuses = await Promise.all(
        [1, 2].map(async () => {
          const response = await http()
            .post('/api/auth/register')
            .send(registration);
          return response.status;
        }),
      );

      expect(statuses.sort()).toEqual([201, 409]);
      expect(await prisma.user.count()).toBe(1);
    });

    it('resets the password with the emailed code and ends every session', async () => {
      const user = await createUser(prisma);
      const first = await login(user.email);
      const second = await login(user.email);

      await http()
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
      await http()
        .post('/api/auth/reset-password')
        .send({
          email: user.email,
          code: emails.lastCode('password-reset', user.email),
          password: 'a-brand-new-password',
        })
        .expect(200);

      for (const session of [first, second]) {
        await me(session.accessToken).expect(401);
        await refresh(session.cookie).expect(401);
      }
      await http()
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      await login(user.email, 'a-brand-new-password');
    });
  });

  describe('sessions', () => {
    it('protects authenticated endpoints', async () => {
      await http().get('/api/auth/me').expect(401);
    });

    it('keeps the refresh token out of reach of page scripts', async () => {
      const user = await createUser(prisma);
      const { response, accessToken } = await login(user.email);

      expect(response.body).toEqual({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
        accessToken,
      });
      const setCookie = setCookieHeader(response);
      expect(setCookie).toMatch(/; HttpOnly/);
      expect(setCookie).toMatch(/; SameSite=Strict/);
      expect(setCookie).toMatch(/; Path=\/api\/auth(;|$)/);
      expect(setCookie).toMatch(/; Expires=/);

      const sessions = await prisma.session.findMany();
      expect(sessions).toEqual([
        expect.objectContaining({ userId: user.id, userAgent: 'e2e-browser' }),
      ]);
      // Only a hash of the token is stored.
      const [token] = await prisma.refreshToken.findMany();
      expect(setCookie).not.toContain(token.tokenHash);
    });

    it('issues an access token that /api/auth/me accepts', async () => {
      const user = await createUser(prisma);
      const { accessToken } = await login(user.email);

      const response = await me(accessToken).expect(200);

      expect(response.body).toMatchObject({ id: user.id, email: user.email });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rotates the refresh cookie and keeps the session', async () => {
      const user = await createUser(prisma);
      const { cookie } = await login(user.email);

      const refreshed = await refresh(cookie).expect(200);
      const nextCookie = cookiePair(setCookieHeader(refreshed));
      const { accessToken } = refreshed.body as { accessToken: string };

      expect(nextCookie).not.toBe(cookie);
      expect(refreshed.body).toMatchObject({ user: { id: user.id } });
      await me(accessToken).expect(200);
      await refresh(nextCookie).expect(200);
      expect(await prisma.session.count()).toBe(1);
    });

    it('answers a concurrent refresh with the same cookie without rotating again', async () => {
      const user = await createUser(prisma);
      const { cookie } = await login(user.email);
      await refresh(cookie).expect(200);

      const second = await refresh(cookie).expect(200);

      expect(second.headers['set-cookie']).toBeUndefined();
      expect(second.body).toHaveProperty('accessToken');
    });

    it('revokes the session when an old refresh cookie comes back', async () => {
      const user = await createUser(prisma);
      const { cookie, accessToken } = await login(user.email);
      const refreshed = await refresh(cookie).expect(200);
      const currentCookie = cookiePair(setCookieHeader(refreshed));
      // Move the rotation outside the grace window.
      await prisma.refreshToken.updateMany({
        where: { rotatedAt: { not: null } },
        data: { rotatedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1_000) },
      });

      const reuse = await refresh(cookie).expect(401);

      expect(setCookieHeader(reuse)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(await prisma.session.findFirst()).toMatchObject({
        revokedReason: 'TOKEN_REUSE',
      });
      // Whoever holds the newest cookie or an access token is out too.
      await refresh(currentCookie).expect(401);
      await me(accessToken).expect(401);
    });

    it('signs out immediately on logout', async () => {
      const user = await createUser(prisma);
      const { cookie, accessToken } = await login(user.email);

      const logout = await http()
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(setCookieHeader(logout)).toMatch(/Expires=Thu, 01 Jan 1970/);
      // The access token has not expired, but its session has ended.
      await me(accessToken).expect(401);
      await refresh(cookie).expect(401);
    });

    it('rejects a refresh without a cookie', async () => {
      await refresh().expect(401);
    });

    it('rejects an access token without a session', async () => {
      const user = await createUser(prisma);
      const jwt = app.get(JwtService);
      // Tokens issued before sessions existed carry no session id.
      const legacyToken = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      await me(legacyToken).expect(401);
    });
  });

  describe('listings', () => {
    it('requires sign-in to post a job', async () => {
      await http().post('/api/listings').send(listingInput).expect(401);
    });

    it('returns a new job in the same shape as GET /api/listings/:id', async () => {
      const { user, auth } = await signedInUser('Amra Hodžić');

      const created = await postListing(auth);
      const fetched = await http().get(`/api/listings/${created.id}`);

      expect(created).toEqual(fetched.body);
      expect(created).toMatchObject({
        ...listingInput,
        client: { id: user.id, fullName: 'Amra Hodžić' },
      });
    });

    it('filters jobs by category and location, and searches without case', async () => {
      const { auth } = await signedInUser();
      await postListing(auth);
      await postListing(auth, {
        title: 'Generalno čišćenje stana',
        category: 'Čišćenje',
        location: 'Mostar',
      });

      const byCategory = await http()
        .get('/api/listings')
        .query({ category: 'Čišćenje' })
        .expect(200);
      const byLocation = await http()
        .get('/api/listings')
        .query({ location: 'Ilidža' })
        .expect(200);
      const bySearch = await http()
        .get('/api/listings')
        .query({ q: 'ŽIVICE' })
        .expect(200);

      expect(byCategory.body).toMatchObject({
        total: 1,
        items: [{ title: 'Generalno čišćenje stana' }],
      });
      expect(byLocation.body).toMatchObject({
        total: 1,
        items: [{ location: 'Ilidža' }],
      });
      expect(bySearch.body).toMatchObject({
        total: 1,
        items: [{ title: listingInput.title }],
      });
    });

    it('pages through jobs, newest first', async () => {
      const { auth } = await signedInUser();
      for (const title of ['Prvi posao', 'Drugi posao', 'Treći posao']) {
        await postListing(auth, { ...listingInput, title });
      }

      const response = await http()
        .get('/api/listings')
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(response.body).toMatchObject({
        total: 3,
        page: 2,
        limit: 2,
        totalPages: 2,
        items: [{ title: 'Prvi posao' }],
      });
    });

    it('lets only the owner edit or delete a job', async () => {
      const owner = await signedInUser();
      const other = await signedInUser();
      const { id } = await postListing(owner.auth);

      await http()
        .patch(`/api/listings/${id}`)
        .set('Authorization', other.auth)
        .send({ budget: '1 KM' })
        .expect(403);
      await http()
        .delete(`/api/listings/${id}`)
        .set('Authorization', other.auth)
        .expect(403);

      const updated = await http()
        .patch(`/api/listings/${id}`)
        .set('Authorization', owner.auth)
        .send({ budget: '80 KM' })
        .expect(200);
      expect(updated.body).toMatchObject({ budget: '80 KM' });
    });

    it('deletes a job together with its applications', async () => {
      const owner = await signedInUser();
      const executor = await signedInUser();
      const { id } = await postListing(owner.auth);
      await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId: id, message: 'Mogu doći sutra poslijepodne.' })
        .expect(201);

      const deleted = await http()
        .delete(`/api/listings/${id}`)
        .set('Authorization', owner.auth)
        .expect(204);

      expect(deleted.text).toBe('');
      await http().get(`/api/listings/${id}`).expect(404);
      expect(await prisma.application.count()).toBe(0);
    });

    it('returns 404 for an unknown job', async () => {
      await http().get('/api/listings/does-not-exist').expect(404);
    });
  });

  describe('applications', () => {
    const message = 'Imam iskustva, mogu doći u subotu ujutro.';

    async function listingWithApplicant() {
      const client = await signedInUser('Amra Hodžić');
      const executor = await signedInUser('Kenan Mehić');
      const { id: listingId } = await postListing(client.auth);
      const application = await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message, proposedPrice: '55 KM' })
        .expect(201);
      return {
        client,
        executor,
        listingId,
        applicationId: (application.body as { id: string }).id,
      };
    }

    it('accepts one application per executor and job', async () => {
      const { executor, listingId } = await listingWithApplicant();

      // There is no check before the insert, so this is the database's
      // unique constraint, mapped to 409.
      await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message })
        .expect(409);
      expect(await prisma.application.count()).toBe(1);
    });

    it('does not let a client apply to their own job', async () => {
      const client = await signedInUser();
      const { id: listingId } = await postListing(client.auth);

      await http()
        .post('/api/applications')
        .set('Authorization', client.auth)
        .send({ listingId, message })
        .expect(403);
    });

    it('returns 404 when applying to an unknown job', async () => {
      const executor = await signedInUser();

      await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId: 'does-not-exist', message })
        .expect(404);
    });

    it('shows the client the application and lets them accept it', async () => {
      const { client, executor, applicationId } = await listingWithApplicant();

      const received = await http()
        .get('/api/applications/received')
        .set('Authorization', client.auth)
        .expect(200);
      expect(received.body).toMatchObject({
        total: 1,
        items: [{ id: applicationId, message, status: 'PENDING' }],
      });

      await http()
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      const sent = await http()
        .get('/api/applications/my')
        .set('Authorization', executor.auth)
        .expect(200);
      expect(sent.body).toMatchObject({
        total: 1,
        items: [{ id: applicationId, status: 'ACCEPTED' }],
      });
    });

    it('lets only the client decide on an application', async () => {
      const { executor, applicationId } = await listingWithApplicant();

      await http()
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', executor.auth)
        .send({ status: 'ACCEPTED' })
        .expect(403);
      expect(await prisma.application.findFirst()).toMatchObject({
        status: 'PENDING',
      });
    });
  });
});
