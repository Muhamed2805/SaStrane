import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { EmailService } from '../src/email/email.service.js';
import { ROTATION_GRACE_MS } from '../src/auth/sessions.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { contractCheckedRequest } from './openapi-contract.js';
import {
  CapturingEmailService,
  PASSWORD,
  cookiePair,
  createUser,
  resetDatabase,
  setCookieHeader,
} from './helpers.js';

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
  category: 'LAWN_MOWING',
  location: 'ILIDZA',
  budget: 60,
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
        status: 'OPEN',
        client: { id: user.id, fullName: 'Amra Hodžić' },
      });
    });

    it('accepts only the fixed categories and locations', async () => {
      const { auth } = await signedInUser();

      await http()
        .post('/api/listings')
        .set('Authorization', auth)
        .send({ ...listingInput, category: 'Košenje trave' })
        .expect(400);
      await http()
        .get('/api/listings')
        .query({ location: 'Ilidža' })
        .expect(400);
      expect(await prisma.listing.count()).toBe(0);
    });

    it('filters jobs by category, location and status, and searches without case', async () => {
      const { auth } = await signedInUser();
      await postListing(auth);
      const { id: closedId } = await postListing(auth, {
        title: 'Generalno čišćenje stana',
        category: 'CLEANING',
        location: 'MOSTAR',
      });
      await prisma.listing.update({
        where: { id: closedId },
        data: { status: 'CLOSED' },
      });

      const byCategory = await http()
        .get('/api/listings')
        .query({ category: 'CLEANING' })
        .expect(200);
      const byLocation = await http()
        .get('/api/listings')
        .query({ location: 'ILIDZA' })
        .expect(200);
      const open = await http()
        .get('/api/listings')
        .query({ status: 'OPEN' })
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
        items: [{ location: 'ILIDZA' }],
      });
      expect(open.body).toMatchObject({
        total: 1,
        items: [{ title: listingInput.title, status: 'OPEN' }],
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
        .send({ budget: 1 })
        .expect(403);
      await http()
        .delete(`/api/listings/${id}`)
        .set('Authorization', other.auth)
        .expect(403);

      const updated = await http()
        .patch(`/api/listings/${id}`)
        .set('Authorization', owner.auth)
        .send({ budget: 80 })
        .expect(200);
      expect(updated.body).toMatchObject({ budget: 80 });
    });

    it('clears the budget, but never a required field', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);

      await http()
        .patch(`/api/listings/${id}`)
        .set('Authorization', auth)
        .send({ title: null })
        .expect(400);
      const cleared = await http()
        .patch(`/api/listings/${id}`)
        .set('Authorization', auth)
        .send({ budget: null })
        .expect(200);

      expect(cleared.body).toMatchObject({
        title: listingInput.title,
        budget: null,
      });
    });

    it('lets only the owner close and reopen a job', async () => {
      const owner = await signedInUser();
      const other = await signedInUser();
      const { id } = await postListing(owner.auth);
      const setStatus = (auth: string, status: string) =>
        http()
          .patch(`/api/listings/${id}/status`)
          .set('Authorization', auth)
          .send({ status });

      await setStatus(other.auth, 'CLOSED').expect(403);
      await setStatus(owner.auth, 'DONE').expect(400);
      const closed = await setStatus(owner.auth, 'CLOSED').expect(200);
      expect(closed.body).toMatchObject({ id, status: 'CLOSED' });

      const reopened = await setStatus(owner.auth, 'OPEN').expect(200);
      expect(reopened.body).toMatchObject({ id, status: 'OPEN' });
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
        .send({ listingId, message, proposedPrice: 55 })
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

    it('takes no applications to a closed job', async () => {
      const client = await signedInUser();
      const executor = await signedInUser();
      const { id: listingId } = await postListing(client.auth);
      await http()
        .patch(`/api/listings/${listingId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'CLOSED' })
        .expect(200);

      const response = await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message })
        .expect(409);

      expect(response.body).toMatchObject({ code: 'LISTING_CLOSED' });
      expect(await prisma.application.count()).toBe(0);
    });

    it('shows the client the application, and the email only after accepting it', async () => {
      const { client, executor, listingId, applicationId } =
        await listingWithApplicant();

      const received = await http()
        .get('/api/applications/received')
        .set('Authorization', client.auth)
        .expect(200);
      expect(received.body).toMatchObject({
        total: 1,
        items: [
          {
            id: applicationId,
            message,
            proposedPrice: 55,
            status: 'PENDING',
            executor: { id: executor.user.id, email: null },
            listing: { title: listingInput.title, status: 'OPEN' },
          },
        ],
      });
      const forListing = await http()
        .get(`/api/applications/listing/${listingId}`)
        .set('Authorization', client.auth)
        .expect(200);
      expect(forListing.body).toMatchObject([
        { id: applicationId, executor: { email: null } },
      ]);

      const accepted = await http()
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'ACCEPTED' })
        .expect(200);
      expect(accepted.body).toMatchObject({
        status: 'ACCEPTED',
        executor: { email: executor.user.email },
      });
      expect(emails.decisions).toEqual([
        {
          email: executor.user.email,
          listingId,
          listingTitle: listingInput.title,
          clientName: 'Amra Hodžić',
          accepted: true,
        },
      ]);

      const sent = await http()
        .get('/api/applications/my')
        .set('Authorization', executor.auth)
        .expect(200);
      expect(sent.body).toMatchObject({
        total: 1,
        items: [{ id: applicationId, status: 'ACCEPTED' }],
      });
    });

    it('treats a decision as final', async () => {
      const { client, applicationId } = await listingWithApplicant();
      const decide = (status: string) =>
        http()
          .patch(`/api/applications/${applicationId}/status`)
          .set('Authorization', client.auth)
          .send({ status });

      await decide('REJECTED').expect(200);
      const second = await decide('ACCEPTED').expect(409);

      expect(second.body).toMatchObject({
        code: 'APPLICATION_ALREADY_DECIDED',
      });
      // Only the decision that went through tells the executor.
      expect(emails.decisions).toMatchObject([{ accepted: false }]);
      expect(await prisma.application.findFirst()).toMatchObject({
        status: 'REJECTED',
      });
    });

    it('lets only one of two decisions sent at once go through', async () => {
      const { client, applicationId } = await listingWithApplicant();

      const statuses = await Promise.all(
        ['ACCEPTED', 'REJECTED'].map(async (status) => {
          const response = await http()
            .patch(`/api/applications/${applicationId}/status`)
            .set('Authorization', client.auth)
            .send({ status });
          return response.status;
        }),
      );

      expect(statuses.sort()).toEqual([200, 409]);
      expect(emails.decisions).toHaveLength(1);
    });

    it('still lets the client decide after closing the job', async () => {
      const { client, listingId, applicationId } = await listingWithApplicant();
      await http()
        .patch(`/api/listings/${listingId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'CLOSED' })
        .expect(200);

      await http()
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'ACCEPTED' })
        .expect(200);
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
      expect(emails.decisions).toEqual([]);
    });
  });

  describe('conversations', () => {
    const question = 'Da li je kosilica benzinska ili električna?';

    async function openJob() {
      const client = await signedInUser('Amra Hodžić');
      const executor = await signedInUser('Kenan Mehić');
      const { id: listingId } = await postListing(client.auth);
      return { client, executor, listingId };
    }

    function start(auth: string, body: object) {
      return http()
        .post('/api/conversations')
        .set('Authorization', auth)
        .send(body);
    }

    async function startAs(auth: string, listingId: string) {
      const response = await start(auth, { listingId }).expect(200);
      return (response.body as { id: string }).id;
    }

    function send(auth: string, conversationId: string, body: string) {
      return http()
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', auth)
        .send({ body });
    }

    async function unreadCount(auth: string) {
      const response = await http()
        .get('/api/conversations/unread-count')
        .set('Authorization', auth)
        .expect(200);
      return (response.body as { count: number }).count;
    }

    it('lets a user ask about a job and the client answer', async () => {
      const { client, executor, listingId } = await openJob();

      const started = await start(executor.auth, { listingId }).expect(200);
      const id = (started.body as { id: string }).id;
      expect(started.body).toMatchObject({
        role: 'EXECUTOR',
        listing: { id: listingId, status: 'OPEN' },
        otherUser: { id: client.user.id, fullName: 'Amra Hodžić' },
        lastMessage: null,
        unreadCount: 0,
      });
      // Starting again returns the same conversation.
      expect(await startAs(executor.auth, listingId)).toBe(id);

      // A conversation without messages is not listed.
      const empty = await http()
        .get('/api/conversations')
        .set('Authorization', client.auth)
        .expect(200);
      expect(empty.body).toMatchObject({ total: 0, items: [] });

      const sent = await send(executor.auth, id, ` ${question} `).expect(201);
      expect(sent.body).toMatchObject({
        senderId: executor.user.id,
        body: question,
      });
      expect(await unreadCount(client.auth)).toBe(1);
      expect(await unreadCount(executor.auth)).toBe(0);

      const listed = await http()
        .get('/api/conversations')
        .set('Authorization', client.auth)
        .expect(200);
      expect(listed.body).toMatchObject({
        total: 1,
        items: [
          {
            id,
            role: 'CLIENT',
            otherUser: { id: executor.user.id, fullName: 'Kenan Mehić' },
            lastMessage: { body: question },
            unreadCount: 1,
          },
        ],
      });

      await http()
        .post(`/api/conversations/${id}/read`)
        .set('Authorization', client.auth)
        .expect(204);
      expect(await unreadCount(client.auth)).toBe(0);

      await send(client.auth, id, 'Električna je.').expect(201);
      expect(await unreadCount(executor.auth)).toBe(1);

      const messages = await http()
        .get(`/api/conversations/${id}/messages`)
        .set('Authorization', executor.auth)
        .expect(200);
      expect(messages.body).toMatchObject({
        items: [{ body: 'Električna je.' }, { body: question }],
        nextCursor: null,
      });
    });

    it('pages through the messages, newest first', async () => {
      const { client, executor, listingId } = await openJob();
      const id = await startAs(executor.auth, listingId);
      for (const body of ['Prva', 'Druga', 'Treća']) {
        await send(executor.auth, id, body).expect(201);
      }

      const first = await http()
        .get(`/api/conversations/${id}/messages?limit=2`)
        .set('Authorization', client.auth)
        .expect(200);
      const page = first.body as {
        items: { body: string }[];
        nextCursor: string;
      };
      expect(page.items.map((message) => message.body)).toEqual([
        'Treća',
        'Druga',
      ]);

      const older = await http()
        .get(`/api/conversations/${id}/messages`)
        .query({ limit: 2, before: page.nextCursor })
        .set('Authorization', client.auth)
        .expect(200);
      expect(older.body).toMatchObject({
        items: [{ body: 'Prva' }],
        nextCursor: null,
      });
    });

    it('lets the client write only to users who applied, also after closing the job', async () => {
      const { client, executor, listingId } = await openJob();

      await start(client.auth, { listingId }).expect(403);
      await start(client.auth, {
        listingId,
        executorId: executor.user.id,
      }).expect(403);

      await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message: 'Mogu doći u subotu ujutro.' })
        .expect(201);
      await http()
        .patch(`/api/listings/${listingId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'CLOSED' })
        .expect(200);

      const started = await start(client.auth, {
        listingId,
        executorId: executor.user.id,
      }).expect(200);
      expect(started.body).toMatchObject({
        role: 'CLIENT',
        otherUser: { id: executor.user.id },
      });
    });

    it('starts no new conversation about a closed job, but keeps the old ones', async () => {
      const { client, executor, listingId } = await openJob();
      const late = await signedInUser();
      const id = await startAs(executor.auth, listingId);
      await http()
        .patch(`/api/listings/${listingId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'CLOSED' })
        .expect(200);

      const refused = await start(late.auth, { listingId }).expect(409);
      expect(refused.body).toMatchObject({ code: 'LISTING_CLOSED' });

      await send(executor.auth, id, question).expect(201);
    });

    it('keeps everyone else out of a conversation', async () => {
      const { executor, listingId } = await openJob();
      const stranger = await signedInUser();
      const id = await startAs(executor.auth, listingId);

      await start(stranger.auth, {
        listingId,
        executorId: executor.user.id,
      }).expect(403);
      await http()
        .get(`/api/conversations/${id}`)
        .set('Authorization', stranger.auth)
        .expect(403);
      await http()
        .get(`/api/conversations/${id}/messages`)
        .set('Authorization', stranger.auth)
        .expect(403);
      await send(stranger.auth, id, question).expect(403);
      await http()
        .get('/api/conversations/does-not-exist')
        .set('Authorization', stranger.auth)
        .expect(404);
    });

    it('rejects an empty message', async () => {
      const { executor, listingId } = await openJob();
      const id = await startAs(executor.auth, listingId);

      await send(executor.auth, id, '   ').expect(400);
      expect(await prisma.message.count()).toBe(0);
    });

    it('deletes the conversations together with the job', async () => {
      const { client, executor, listingId } = await openJob();
      const id = await startAs(executor.auth, listingId);
      await send(executor.auth, id, question).expect(201);

      await http()
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', client.auth)
        .expect(204);

      expect(await prisma.conversation.count()).toBe(0);
      expect(await prisma.message.count()).toBe(0);
      expect(await unreadCount(executor.auth)).toBe(0);
    });
  });

  describe('ratings', () => {
    // A closed job whose client accepted the executor.
    async function finishedJob() {
      const client = await signedInUser('Amra Hodžić');
      const executor = await signedInUser('Kenan Mehić');
      const { id: listingId } = await postListing(client.auth);
      const application = await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message: 'Mogu doći u subotu ujutro.' })
        .expect(201);
      const applicationId = (application.body as { id: string }).id;
      await http()
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'ACCEPTED' })
        .expect(200);
      await http()
        .patch(`/api/listings/${listingId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'CLOSED' })
        .expect(200);
      return { client, executor, listingId, applicationId };
    }

    function rate(auth: string, body: object) {
      return http().post('/api/ratings').set('Authorization', auth).send(body);
    }

    it('lets the client rate the executor once the job is closed', async () => {
      const { client, executor, listingId, applicationId } =
        await finishedJob();

      const before = await http()
        .get(`/api/applications/listing/${listingId}`)
        .set('Authorization', client.auth)
        .expect(200);
      expect(before.body).toMatchObject([
        {
          canRate: true,
          rating: null,
          executor: { rating: { average: null, count: 0 } },
        },
      ]);

      const rated = await rate(client.auth, {
        applicationId,
        score: 4,
        comment: '  Brzo i uredno.  ',
      }).expect(201);
      expect(rated.body).toMatchObject({
        score: 4,
        comment: 'Brzo i uredno.',
        listingId,
        listingTitle: listingInput.title,
        client: { id: client.user.id, fullName: 'Amra Hodžić' },
      });

      const after = await http()
        .get(`/api/applications/listing/${listingId}`)
        .set('Authorization', client.auth)
        .expect(200);
      expect(after.body).toMatchObject([
        {
          canRate: false,
          rating: { score: 4, comment: 'Brzo i uredno.' },
          executor: { rating: { average: 4, count: 1 } },
        },
      ]);

      // The executor sees the rating on their own application.
      const sent = await http()
        .get('/api/applications/my')
        .set('Authorization', executor.auth)
        .expect(200);
      expect(sent.body).toMatchObject({
        items: [{ id: applicationId, rating: { score: 4 } }],
      });

      const profile = await http()
        .get(`/api/users/${executor.user.id}`)
        .expect(200);
      expect(profile.body).toEqual({
        id: executor.user.id,
        fullName: 'Kenan Mehić',
        createdAt: expect.any(String) as unknown,
        rating: { average: 4, count: 1 },
      });

      const ratings = await http()
        .get(`/api/users/${executor.user.id}/ratings`)
        .expect(200);
      expect(ratings.body).toMatchObject({
        total: 1,
        items: [{ score: 4, listingTitle: listingInput.title }],
      });
    });

    it('rates each application once', async () => {
      const { client, applicationId } = await finishedJob();

      await rate(client.auth, { applicationId, score: 5 }).expect(201);
      const second = await rate(client.auth, { applicationId, score: 1 });

      expect(second.status).toBe(409);
      expect(second.body).toMatchObject({ code: 'ALREADY_RATED' });
      expect(await prisma.rating.findFirst()).toMatchObject({ score: 5 });
    });

    it('waits until the job is closed and the application accepted', async () => {
      const client = await signedInUser();
      const executor = await signedInUser();
      const { id: listingId } = await postListing(client.auth);
      const application = await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message: 'Mogu doći u subotu ujutro.' })
        .expect(201);
      const applicationId = (application.body as { id: string }).id;

      const pending = await rate(client.auth, { applicationId, score: 5 });
      expect(pending.status).toBe(409);
      expect(pending.body).toMatchObject({ code: 'APPLICATION_NOT_ACCEPTED' });

      await http()
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'ACCEPTED' })
        .expect(200);
      const open = await rate(client.auth, { applicationId, score: 5 });
      expect(open.status).toBe(409);
      expect(open.body).toMatchObject({ code: 'LISTING_NOT_CLOSED' });
      expect(await prisma.rating.count()).toBe(0);
    });

    it('lets only the client rate, with 1 to 5 stars', async () => {
      const { executor, client, applicationId } = await finishedJob();
      const stranger = await signedInUser();

      await rate(executor.auth, { applicationId, score: 5 }).expect(403);
      await rate(stranger.auth, { applicationId, score: 5 }).expect(403);
      await rate(client.auth, { applicationId, score: 0 }).expect(400);
      await rate(client.auth, { applicationId, score: 6 }).expect(400);
      await rate(client.auth, { applicationId, score: 4.5 }).expect(400);
      await rate(client.auth, {
        applicationId,
        score: 5,
        comment: 'x'.repeat(1001),
      }).expect(400);
      await rate(client.auth, { applicationId: 'missing', score: 5 }).expect(
        404,
      );
      await http()
        .post('/api/ratings')
        .send({ applicationId, score: 5 })
        .expect(401);
      expect(await prisma.rating.count()).toBe(0);
    });

    it('keeps the rating when the job is deleted', async () => {
      const { client, executor, listingId, applicationId } =
        await finishedJob();
      await rate(client.auth, { applicationId, score: 5 }).expect(201);

      await http()
        .delete(`/api/listings/${listingId}`)
        .set('Authorization', client.auth)
        .expect(204);

      const ratings = await http()
        .get(`/api/users/${executor.user.id}/ratings`)
        .expect(200);
      expect(ratings.body).toMatchObject({
        total: 1,
        items: [{ listingId: null, listingTitle: listingInput.title }],
      });
    });

    it('returns 404 for the profile of an unknown user', async () => {
      await http().get('/api/users/does-not-exist').expect(404);
      await http().get('/api/users/does-not-exist/ratings').expect(404);
    });

    it('keeps the email off the public profile', async () => {
      const { user } = await signedInUser();

      const profile = await http().get(`/api/users/${user.id}`).expect(200);

      expect(JSON.stringify(profile.body)).not.toContain(user.email);
    });
  });
});
