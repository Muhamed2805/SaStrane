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
import sharp from 'sharp';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { EmailService } from '../src/email/email.service.js';
import { MessageEmailsService } from '../src/conversations/message-emails.service.js';
import { ROTATION_GRACE_MS } from '../src/auth/sessions.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StorageService } from '../src/storage/storage.service.js';
import { contractCheckedRequest } from './openapi-contract.js';
import {
  CapturingEmailService,
  MemoryStorageService,
  PASSWORD,
  cookiePair,
  createUser,
  resetDatabase,
  setCookieHeader,
} from './helpers.js';

// The app runs with its real configuration against the e2e database. Only
// email delivery, the photo storage and the rate limiter's storage are
// swapped out. Every response must match openapi.json.

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
  const storage = new MemoryStorageService();
  const contractViolations: string[] = [];
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emails)
      .overrideProvider(StorageService)
      .useValue(storage)
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
    storage.clear();
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
    return { user, accessToken, auth: `Bearer ${accessToken}` };
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
          emailNotifications: true,
          bio: null,
          skills: [],
          avatarUrl: null,
          isAdmin: false,
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

  describe('saved listings', () => {
    const savedIds = async (auth: string) =>
      (
        await http()
          .get('/api/saved-listings/ids')
          .set('Authorization', auth)
          .expect(200)
      ).body as string[];

    it('needs a signed-in user', async () => {
      await http().get('/api/saved-listings').expect(401);
      await http().put('/api/saved-listings/any').expect(401);
    });

    it('saves jobs once and lists them, the last saved first', async () => {
      const client = await signedInUser('Amra Hodžić');
      const executor = await signedInUser('Kenan Mehić');
      const first = await postListing(client.auth);
      const second = await postListing(client.auth);
      const save = (id: string) =>
        http()
          .put(`/api/saved-listings/${id}`)
          .set('Authorization', executor.auth);

      await save(first.id).expect(204);
      await save(second.id).expect(204);
      await save(first.id).expect(204);

      const list = await http()
        .get('/api/saved-listings')
        .set('Authorization', executor.auth)
        .expect(200);
      expect(list.body).toMatchObject({
        items: [{ id: second.id }, { id: first.id }],
        total: 2,
        totalPages: 1,
      });
      expect(new Set(await savedIds(executor.auth))).toEqual(
        new Set([first.id, second.id]),
      );
      // Each user has their own list.
      expect(await savedIds(client.auth)).toEqual([]);
    });

    it('keeps closed jobs and drops deleted ones', async () => {
      const client = await signedInUser();
      const executor = await signedInUser();
      const closed = await postListing(client.auth);
      const deleted = await postListing(client.auth);
      for (const { id } of [closed, deleted]) {
        await http()
          .put(`/api/saved-listings/${id}`)
          .set('Authorization', executor.auth)
          .expect(204);
      }

      await http()
        .patch(`/api/listings/${closed.id}/status`)
        .set('Authorization', client.auth)
        .send({ status: 'CLOSED' })
        .expect(200);
      await http()
        .delete(`/api/listings/${deleted.id}`)
        .set('Authorization', client.auth)
        .expect(204);

      const list = await http()
        .get('/api/saved-listings')
        .set('Authorization', executor.auth)
        .expect(200);
      expect(list.body).toMatchObject({
        items: [{ id: closed.id, status: 'CLOSED' }],
        total: 1,
      });
    });

    it('refuses the user own job and a missing one', async () => {
      const client = await signedInUser();
      const { id } = await postListing(client.auth);

      await http()
        .put(`/api/saved-listings/${id}`)
        .set('Authorization', client.auth)
        .expect(403);
      await http()
        .put('/api/saved-listings/missing')
        .set('Authorization', client.auth)
        .expect(404);
    });

    it('removes a saved job, and removing it again is fine', async () => {
      const client = await signedInUser();
      const executor = await signedInUser();
      const { id } = await postListing(client.auth);
      await http()
        .put(`/api/saved-listings/${id}`)
        .set('Authorization', executor.auth)
        .expect(204);

      for (let i = 0; i < 2; i++) {
        await http()
          .delete(`/api/saved-listings/${id}`)
          .set('Authorization', executor.auth)
          .expect(204);
      }
      expect(await savedIds(executor.auth)).toEqual([]);
    });
  });

  describe('moderation', () => {
    type Report = {
      id: string;
      status: string;
      listing: { id: string | null; title: string } | null;
    };

    async function signedInAdmin() {
      const admin = await signedInUser('Admin SaStrane');
      await prisma.user.update({
        where: { id: admin.user.id },
        data: { isAdmin: true },
      });
      return admin;
    }

    const report = (auth: string, body: object) =>
      http().post('/api/reports').set('Authorization', auth).send(body);

    const openReports = async (auth: string) =>
      (
        await http()
          .get('/api/admin/reports?status=OPEN')
          .set('Authorization', auth)
          .expect(200)
      ).body as { items: Report[]; total: number };

    it('takes one open report per user and target', async () => {
      const client = await signedInUser('Amra Hodžić');
      const reporter = await signedInUser('Kenan Mehić');
      const { id: listingId } = await postListing(client.auth);

      await http().post('/api/reports').send({}).expect(401);
      await report(reporter.auth, {
        listingId,
        reason: 'SCAM',
        details: '  Traži uplatu unaprijed.  ',
      }).expect(204);
      const again = await report(reporter.auth, {
        listingId,
        reason: 'SPAM',
      }).expect(409);
      expect(again.body).toMatchObject({ code: 'ALREADY_REPORTED' });
      // The client is a separate target from their job.
      await report(reporter.auth, {
        userId: client.user.id,
        reason: 'OTHER',
      }).expect(204);

      await report(client.auth, { listingId, reason: 'SPAM' }).expect(403);
      await report(reporter.auth, {
        userId: reporter.user.id,
        reason: 'SPAM',
      }).expect(403);
      await report(reporter.auth, { reason: 'SPAM' }).expect(400);
      await report(reporter.auth, {
        listingId,
        userId: client.user.id,
        reason: 'SPAM',
      }).expect(400);
      await report(reporter.auth, {
        userId: 'missing',
        reason: 'SPAM',
      }).expect(404);
    });

    it('lets only admins see and handle reports', async () => {
      const client = await signedInUser('Amra Hodžić');
      const reporter = await signedInUser('Kenan Mehić');
      const admin = await signedInAdmin();
      const { id: listingId } = await postListing(client.auth);
      await report(reporter.auth, {
        listingId,
        reason: 'SCAM',
        details: 'Traži uplatu unaprijed.',
      }).expect(204);

      await http()
        .get('/api/admin/reports')
        .set('Authorization', reporter.auth)
        .expect(403);
      expect((await me(admin.accessToken)).body).toMatchObject({
        isAdmin: true,
      });

      const { items } = await openReports(admin.auth);
      expect(items).toMatchObject([
        {
          reason: 'SCAM',
          details: 'Traži uplatu unaprijed.',
          status: 'OPEN',
          reporter: { id: reporter.user.id, fullName: 'Kenan Mehić' },
          reportedUser: { id: client.user.id, suspended: false },
          listing: { id: listingId, status: 'OPEN' },
          handledBy: null,
        },
      ]);

      const handle = (status: string) =>
        http()
          .patch(`/api/admin/reports/${items[0].id}`)
          .set('Authorization', admin.auth)
          .send({ status });
      const dismissed = await handle('DISMISSED').expect(200);
      expect(dismissed.body).toMatchObject({
        status: 'DISMISSED',
        handledBy: { id: admin.user.id },
      });
      const twice = await handle('RESOLVED').expect(409);
      expect(twice.body).toMatchObject({ code: 'REPORT_ALREADY_HANDLED' });
      await handle('OPEN').expect(400);
      expect((await openReports(admin.auth)).total).toBe(0);
    });

    it('deletes a reported job and keeps its title on the report', async () => {
      const client = await signedInUser();
      const reporter = await signedInUser();
      const admin = await signedInAdmin();
      const { id: listingId } = await postListing(client.auth);
      await report(reporter.auth, { listingId, reason: 'SPAM' }).expect(204);

      await http()
        .delete(`/api/admin/listings/${listingId}`)
        .set('Authorization', admin.auth)
        .expect(204);

      await http().get(`/api/listings/${listingId}`).expect(404);
      const all = await http()
        .get('/api/admin/reports')
        .set('Authorization', admin.auth)
        .expect(200);
      expect(all.body).toMatchObject({
        items: [
          {
            status: 'RESOLVED',
            listing: { id: null, title: listingInput.title, status: null },
          },
        ],
      });
    });

    it('suspends a user until an admin lifts it', async () => {
      const client = await signedInUser();
      const reporter = await signedInUser();
      const admin = await signedInAdmin();
      const { id: listingId } = await postListing(client.auth);
      await report(reporter.auth, {
        userId: client.user.id,
        reason: 'SCAM',
      }).expect(204);
      const suspend = (id: string) =>
        http()
          .post(`/api/admin/users/${id}/suspend`)
          .set('Authorization', admin.auth);

      await suspend(client.user.id).expect(204);

      await me(client.accessToken).expect(401);
      const denied = await http()
        .post('/api/auth/login')
        .send({ email: client.user.email, password: PASSWORD })
        .expect(403);
      expect(denied.body).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
      const job = await http().get(`/api/listings/${listingId}`).expect(200);
      expect(job.body).toMatchObject({ status: 'CLOSED' });
      expect((await openReports(admin.auth)).total).toBe(0);

      await suspend(admin.user.id).expect(403);
      await http()
        .post(`/api/admin/users/${client.user.id}/unsuspend`)
        .set('Authorization', admin.auth)
        .expect(204);
      await login(client.user.email);
    });

    it('locks out a session that a sign-in started during the suspension', async () => {
      const user = await createUser(prisma);
      // The sign-in passed its check just before the suspension was saved.
      const { accessToken, cookie } = await login(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { suspendedAt: new Date() },
      });

      await me(accessToken).expect(401);
      await refresh(cookie).expect(401);
    });

    it('gives admins the totals and every user and job', async () => {
      const client = await signedInUser('Amra Hodžić');
      const reporter = await signedInUser('Kenan Mehić');
      const admin = await signedInAdmin();
      const { id: lawnId } = await postListing(client.auth);
      const { id: fenceId } = await postListing(client.auth, {
        ...listingInput,
        title: 'Farbanje drvene ograde',
      });
      await report(reporter.auth, {
        listingId: fenceId,
        reason: 'SPAM',
      }).expect(204);
      const get = (path: string) =>
        http().get(`/api/admin/${path}`).set('Authorization', admin.auth);
      const items = (response: { body: unknown }) =>
        (response.body as { items: unknown[] }).items;
      const setStatus = (id: string, status: string) =>
        http()
          .patch(`/api/admin/listings/${id}/status`)
          .set('Authorization', admin.auth)
          .send({ status });

      await http()
        .get('/api/admin/stats')
        .set('Authorization', client.auth)
        .expect(403);
      expect((await get('stats').expect(200)).body).toEqual({
        users: 3,
        newUsers: 3,
        suspendedUsers: 0,
        openListings: 2,
        closedListings: 0,
        newListings: 2,
        applications: 0,
        newApplications: 0,
        openReports: 1,
      });

      const found = await get('users?q=amra').expect(200);
      expect(found.body).toMatchObject({ total: 1, page: 1, limit: 20 });
      expect(items(found)).toEqual([
        {
          id: client.user.id,
          fullName: 'Amra Hodžić',
          email: client.user.email,
          role: 'BOTH',
          avatarUrl: null,
          isAdmin: false,
          suspendedAt: null,
          emailVerified: true,
          createdAt: expect.any(String) as unknown,
          listings: 2,
          applications: 0,
          openReports: 1,
        },
      ]);
      const admins = await get('users?filter=ADMINS').expect(200);
      expect(items(admins)).toMatchObject([{ id: admin.user.id }]);
      await get('users?filter=EVERYONE').expect(400);

      const jobs = await get('listings?q=ograde').expect(200);
      expect(items(jobs)).toEqual([
        {
          id: fenceId,
          title: 'Farbanje drvene ograde',
          status: 'OPEN',
          category: 'LAWN_MOWING',
          location: 'ILIDZA',
          createdAt: expect.any(String) as unknown,
          client: {
            id: client.user.id,
            fullName: 'Amra Hodžić',
            suspended: false,
          },
          applications: 0,
          openReports: 1,
        },
      ]);

      await setStatus(lawnId, 'CLOSED').expect(204);
      const closed = await get('listings?status=CLOSED').expect(200);
      expect(items(closed)).toMatchObject([{ id: lawnId }]);
      await setStatus('missing', 'CLOSED').expect(404);
      await setStatus(lawnId, 'DONE').expect(400);

      await http()
        .post(`/api/admin/users/${client.user.id}/suspend`)
        .set('Authorization', admin.auth)
        .expect(204);
      const reopen = await setStatus(lawnId, 'OPEN').expect(409);
      expect(reopen.body).toMatchObject({ code: 'CLIENT_SUSPENDED' });
      const suspended = await get('users?filter=SUSPENDED').expect(200);
      expect(items(suspended)).toMatchObject([
        { id: client.user.id, suspendedAt: expect.any(String) as unknown },
      ]);
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

    it('emails the client about a new application', async () => {
      const { client } = await listingWithApplicant();

      expect(emails.newApplications).toEqual([
        {
          email: client.user.email,
          listingTitle: listingInput.title,
          executorName: 'Kenan Mehić',
        },
      ]);
    });

    it('sends no activity emails to users who turned them off', async () => {
      const client = await signedInUser('Amra Hodžić');
      const executor = await signedInUser('Kenan Mehić');
      for (const { auth } of [client, executor]) {
        await http()
          .patch('/api/auth/me')
          .set('Authorization', auth)
          .send({ emailNotifications: false })
          .expect(200);
      }
      const { id: listingId } = await postListing(client.auth);
      const application = await http()
        .post('/api/applications')
        .set('Authorization', executor.auth)
        .send({ listingId, message })
        .expect(201);
      await http()
        .patch(
          `/api/applications/${(application.body as { id: string }).id}/status`,
        )
        .set('Authorization', client.auth)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      expect(emails.newApplications).toEqual([]);
      expect(emails.decisions).toEqual([]);
    });

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

    it('emails a user once about messages left unread', async () => {
      const { client, executor, listingId } = await openJob();
      const id = await startAs(executor.auth, listingId);
      const notifier = app.get(MessageEmailsService);
      const later = (minutes: number) =>
        new Date(Date.now() + minutes * 60_000);

      await send(executor.auth, id, question).expect(201);
      await send(executor.auth, id, 'I kada vam odgovara?').expect(201);

      // Not yet: the client may still read it on the site.
      expect(await notifier.sendDue(later(5))).toBe(0);
      expect(await notifier.sendDue(later(11))).toBe(1);
      expect(emails.unreadMessages).toEqual([
        {
          email: client.user.email,
          conversationId: id,
          senderName: 'Kenan Mehić',
          unreadCount: 2,
          lastMessage: 'I kada vam odgovara?',
        },
      ]);

      // No second email until the client reads the conversation.
      await send(executor.auth, id, 'Javite se.').expect(201);
      expect(await notifier.sendDue(later(30))).toBe(0);

      await http()
        .post(`/api/conversations/${id}/read`)
        .set('Authorization', client.auth)
        .expect(204);
      await send(executor.auth, id, 'Još nešto.').expect(201);
      expect(await notifier.sendDue(later(11))).toBe(1);
      expect(emails.unreadMessages).toHaveLength(2);

      // The sender reads their own conversation: they get no email.
      expect(emails.unreadMessages.map(({ email }) => email)).not.toContain(
        executor.user.email,
      );
    });

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
        avatarUrl: null,
        bio: null,
        skills: [],
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

  describe('listing photos', () => {
    let jpeg: Buffer;

    beforeAll(async () => {
      jpeg = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: '#0f9d8a',
        },
      })
        .jpeg()
        .toBuffer();
    });

    function upload(
      auth: string,
      listingId: string,
      file: Buffer = jpeg,
      filename = 'dvoriste.jpg',
    ) {
      return http()
        .post(`/api/listings/${listingId}/photos`)
        .set('Authorization', auth)
        .attach('photo', file, { filename, contentType: 'image/jpeg' });
    }

    type Photo = { id: string; url: string; thumbnailUrl: string };

    it('adds photos and shows them on the job and in lists', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);

      const first = await upload(auth, id).expect(201);
      const second = await upload(auth, id).expect(201);
      const photo = first.body as Photo;

      expect(first.body).toMatchObject({
        url: `https://photos.test/listings/${id}/${photo.id}.webp`,
        thumbnailUrl: `https://photos.test/listings/${id}/${photo.id}-thumb.webp`,
        width: 1600,
        height: 1200,
      });
      expect(
        storage.files.get(`listings/${id}/${photo.id}.webp`),
      ).toMatchObject({ contentType: 'image/webp' });
      expect(storage.files.size).toBe(4);

      const job = await http().get(`/api/listings/${id}`).expect(200);
      expect(job.body).toMatchObject({
        coverPhoto: { id: photo.id },
        photos: [{ id: photo.id }, { id: (second.body as Photo).id }],
      });

      const list = await http().get('/api/listings').expect(200);
      expect(list.body).toMatchObject({
        items: [{ id, coverPhoto: { id: photo.id } }],
      });
    });

    it('takes at most five photos', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);
      for (let i = 0; i < 5; i += 1) await upload(auth, id).expect(201);

      const sixth = await upload(auth, id);

      expect(sixth.status).toBe(409);
      expect(sixth.body).toMatchObject({ code: 'PHOTO_LIMIT_REACHED' });
      expect(await prisma.listingPhoto.count()).toBe(5);
      expect(storage.files.size).toBe(10);
    });

    it('refuses files that are not images, and files over 5 MB', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);

      const text = await upload(auth, id, Buffer.from('nije slika'), 'a.jpg');
      expect(text.status).toBe(400);
      expect(text.body).toMatchObject({ code: 'INVALID_IMAGE' });

      await http()
        .post(`/api/listings/${id}/photos`)
        .set('Authorization', auth)
        .expect(400);

      await upload(auth, id, Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
      expect(await prisma.listingPhoto.count()).toBe(0);
      expect(storage.files.size).toBe(0);
    });

    it('lets only the owner change the photos', async () => {
      const owner = await signedInUser();
      const stranger = await signedInUser();
      const { id } = await postListing(owner.auth);
      const photo = (await upload(owner.auth, id).expect(201)).body as Photo;

      await upload(stranger.auth, id).expect(403);
      await upload(owner.auth, 'missing').expect(404);
      await http()
        .post(`/api/listings/${id}/photos`)
        .attach('photo', jpeg, 'a.jpg')
        .expect(401);
      await http()
        .delete(`/api/listings/${id}/photos/${photo.id}`)
        .set('Authorization', stranger.auth)
        .expect(403);
      await http()
        .put(`/api/listings/${id}/photos/order`)
        .set('Authorization', stranger.auth)
        .send({ photoIds: [photo.id] })
        .expect(403);
      expect(await prisma.listingPhoto.count()).toBe(1);
    });

    it('reorders the photos, which changes the cover', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);
      const a = (await upload(auth, id).expect(201)).body as Photo;
      const b = (await upload(auth, id).expect(201)).body as Photo;

      const reordered = await http()
        .put(`/api/listings/${id}/photos/order`)
        .set('Authorization', auth)
        .send({ photoIds: [b.id, a.id] })
        .expect(200);
      expect((reordered.body as Photo[]).map((photo) => photo.id)).toEqual([
        b.id,
        a.id,
      ]);

      const job = await http().get(`/api/listings/${id}`).expect(200);
      expect(job.body).toMatchObject({ coverPhoto: { id: b.id } });

      await http()
        .put(`/api/listings/${id}/photos/order`)
        .set('Authorization', auth)
        .send({ photoIds: [a.id] })
        .expect(400);
      await http()
        .put(`/api/listings/${id}/photos/order`)
        .set('Authorization', auth)
        .send({ photoIds: [a.id, a.id] })
        .expect(400);
    });

    it('deletes a photo and its files', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);
      const photo = (await upload(auth, id).expect(201)).body as Photo;

      await http()
        .delete(`/api/listings/${id}/photos/${photo.id}`)
        .set('Authorization', auth)
        .expect(204);

      expect(storage.files.size).toBe(0);
      const job = await http().get(`/api/listings/${id}`).expect(200);
      expect(job.body).toMatchObject({ coverPhoto: null, photos: [] });
      await http()
        .delete(`/api/listings/${id}/photos/${photo.id}`)
        .set('Authorization', auth)
        .expect(404);
    });

    it('deletes the files when the job is deleted', async () => {
      const { auth } = await signedInUser();
      const { id } = await postListing(auth);
      await upload(auth, id).expect(201);
      await upload(auth, id).expect(201);

      await http()
        .delete(`/api/listings/${id}`)
        .set('Authorization', auth)
        .expect(204);

      expect(storage.files.size).toBe(0);
      expect(await prisma.listingPhoto.count()).toBe(0);
    });
  });

  describe('account', () => {
    function updateProfile(auth: string, body: object) {
      return http().patch('/api/auth/me').set('Authorization', auth).send(body);
    }

    function changePassword(auth: string, body: object) {
      return http()
        .post('/api/auth/change-password')
        .set('Authorization', auth)
        .send(body);
    }

    function deleteAccount(auth: string, password: string) {
      return http()
        .delete('/api/auth/me')
        .set('Authorization', auth)
        .send({ password });
    }

    it('changes the name and the role', async () => {
      const user = await createUser(prisma);
      const { accessToken, cookie } = await login(user.email);
      const auth = `Bearer ${accessToken}`;

      const response = await updateProfile(auth, {
        fullName: '  Amra Hodžić  ',
        role: 'EXECUTOR',
      }).expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        fullName: 'Amra Hodžić',
        role: 'EXECUTOR',
        emailNotifications: true,
      });
      // A field that is left out stays.
      await updateProfile(auth, { role: 'BOTH' }).expect(200);
      const refreshed = await refresh(cookie).expect(200);
      expect(refreshed.body).toMatchObject({
        user: { fullName: 'Amra Hodžić', role: 'BOTH' },
      });

      await updateProfile(auth, { fullName: 'A' }).expect(400);
      await updateProfile(auth, { role: 'ADMIN' }).expect(400);
      await updateProfile(auth, { email: 'new@example.com' }).expect(400);
      await http().patch('/api/auth/me').send({ fullName: 'Amra' }).expect(401);
    });

    it('shows the introduction and skills on the public profile', async () => {
      const { auth, user } = await signedInUser();

      const response = await updateProfile(auth, {
        bio: '  Kosim travu i montiram namještaj.  ',
        skills: ['LAWN_MOWING', 'ASSEMBLY', 'LAWN_MOWING'],
      }).expect(200);

      expect(response.body).toMatchObject({
        bio: 'Kosim travu i montiram namještaj.',
        skills: ['LAWN_MOWING', 'ASSEMBLY'],
      });
      const profile = await http().get(`/api/users/${user.id}`).expect(200);
      expect(profile.body).toMatchObject({
        bio: 'Kosim travu i montiram namještaj.',
        skills: ['LAWN_MOWING', 'ASSEMBLY'],
      });

      // An empty introduction removes it; no skills clears them.
      await updateProfile(auth, { bio: '  ', skills: [] }).expect(200);
      const cleared = await http().get(`/api/users/${user.id}`).expect(200);
      expect(cleared.body).toMatchObject({ bio: null, skills: [] });

      await updateProfile(auth, { bio: 'a'.repeat(501) }).expect(400);
      await updateProfile(auth, { skills: ['FLYING'] }).expect(400);
      await updateProfile(auth, { skills: 'MOVING' }).expect(400);
    });

    describe('profile photo', () => {
      let jpeg: Buffer;

      beforeAll(async () => {
        jpeg = await sharp({
          create: { width: 900, height: 600, channels: 3, background: '#fff' },
        })
          .jpeg()
          .toBuffer();
      });

      function setAvatar(auth: string, file: Buffer = jpeg) {
        return http()
          .put('/api/auth/me/avatar')
          .set('Authorization', auth)
          .attach('photo', file, {
            filename: 'ja.jpg',
            contentType: 'image/jpeg',
          });
      }

      it('replaces and removes the photo with its file', async () => {
        const { auth, user, accessToken } = await signedInUser();
        const url = new RegExp(
          String.raw`^https://photos\.test/avatars/${user.id}/[0-9a-f-]{36}\.webp$`,
        );

        type WithAvatar = { avatarUrl: string | null };
        const avatarOf = (response: { body: unknown }) =>
          (response.body as WithAvatar).avatarUrl;

        const first = avatarOf(await setAvatar(auth).expect(200));
        expect(first).toMatch(url);
        const key = first!.slice('https://photos.test/'.length);
        expect(storage.files.get(key)?.contentType).toBe('image/webp');
        expect(
          await sharp(storage.files.get(key)?.body).metadata(),
        ).toMatchObject({ format: 'webp', width: 256, height: 256 });

        const second = avatarOf(await setAvatar(auth).expect(200));
        expect(second).toMatch(url);
        expect(second).not.toBe(first);
        expect(storage.files.size).toBe(1);
        const profile = await http().get(`/api/users/${user.id}`).expect(200);
        expect(avatarOf(profile)).toBe(second);
        expect(avatarOf(await me(accessToken).expect(200))).toBe(second);

        const removed = await http()
          .delete('/api/auth/me/avatar')
          .set('Authorization', auth)
          .expect(200);
        expect(avatarOf(removed)).toBeNull();
        expect(storage.files.size).toBe(0);
      });

      it('refuses a missing file or one that is not an image', async () => {
        const { auth } = await signedInUser();

        const invalid = await setAvatar(
          auth,
          Buffer.from('not an image'),
        ).expect(400);
        expect(invalid.body).toMatchObject({ code: 'INVALID_IMAGE' });
        await http()
          .put('/api/auth/me/avatar')
          .set('Authorization', auth)
          .expect(400);
        await http()
          .put('/api/auth/me/avatar')
          .attach('photo', jpeg, 'ja.jpg')
          .expect(401);
        expect(storage.files.size).toBe(0);
      });

      it('shows the photo on applications and in conversations', async () => {
        const client = await signedInUser('Amra Hodžić');
        const executor = await signedInUser('Kenan Mehić');
        const { avatarUrl } = (await setAvatar(executor.auth).expect(200))
          .body as { avatarUrl: string };
        const { id: listingId } = await postListing(client.auth);
        await http()
          .post('/api/applications')
          .set('Authorization', executor.auth)
          .send({ listingId, message: 'Mogu sutra ujutro.' })
          .expect(201);

        const received = await http()
          .get('/api/applications/received')
          .set('Authorization', client.auth)
          .expect(200);
        expect(received.body).toMatchObject({
          items: [{ executor: { id: executor.user.id, avatarUrl } }],
        });
        const forListing = await http()
          .get(`/api/applications/listing/${listingId}`)
          .set('Authorization', client.auth)
          .expect(200);
        expect(forListing.body).toMatchObject([{ executor: { avatarUrl } }]);

        // Each side sees the other one's photo, or null without one.
        const asExecutor = await http()
          .post('/api/conversations')
          .set('Authorization', executor.auth)
          .send({ listingId })
          .expect(200);
        expect(asExecutor.body).toMatchObject({
          otherUser: { id: client.user.id, avatarUrl: null },
        });
        const asClient = await http()
          .get(`/api/conversations/${(asExecutor.body as { id: string }).id}`)
          .set('Authorization', client.auth)
          .expect(200);
        expect(asClient.body).toMatchObject({
          otherUser: { id: executor.user.id, avatarUrl },
        });
      });

      it('shows the client photo on their jobs', async () => {
        const client = await signedInUser('Amra Hodžić');
        const { id: listingId } = await postListing(client.auth);
        const job = () => http().get(`/api/listings/${listingId}`).expect(200);

        expect((await job()).body).toMatchObject({
          client: { id: client.user.id, avatarUrl: null },
        });
        const { avatarUrl } = (await setAvatar(client.auth).expect(200))
          .body as { avatarUrl: string };
        expect((await job()).body).toMatchObject({
          client: { id: client.user.id, avatarUrl },
        });
        const list = await http().get('/api/listings').expect(200);
        expect(list.body).toMatchObject({ items: [{ client: { avatarUrl } }] });
      });
    });

    it('changes the password and signs out the other devices', async () => {
      const user = await createUser(prisma);
      const current = await login(user.email);
      const other = await login(user.email);
      const auth = `Bearer ${current.accessToken}`;

      const wrong = await changePassword(auth, {
        currentPassword: 'not-the-password',
        newPassword: 'a-new-password',
      }).expect(400);
      expect(wrong.body).toMatchObject({ code: 'WRONG_PASSWORD' });
      await changePassword(auth, {
        currentPassword: PASSWORD,
        newPassword: 'short',
      }).expect(400);

      await changePassword(auth, {
        currentPassword: PASSWORD,
        newPassword: 'a-new-password',
      }).expect(204);

      // This device stays signed in; the other one is out.
      await me(current.accessToken).expect(200);
      await refresh(current.cookie).expect(200);
      await me(other.accessToken).expect(401);
      await refresh(other.cookie).expect(401);
      expect(
        await prisma.session.findMany({
          where: { revokedReason: 'PASSWORD_CHANGE' },
        }),
      ).toHaveLength(1);
      expect(emails.passwordChanges).toEqual([user.email]);

      await http()
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      await login(user.email, 'a-new-password');
    });

    it('limits guesses at the current password', async () => {
      const { auth } = await signedInUser();
      const guess = { currentPassword: 'guess', newPassword: 'a-new-password' };

      for (let i = 0; i < 5; i += 1) {
        await changePassword(auth, guess).expect(400);
      }
      await changePassword(auth, guess).expect(429);
    });

    it('deletes the account with its jobs, photos and conversations', async () => {
      const user = await createUser(prisma, { fullName: 'Amra Hodžić' });
      const { accessToken, cookie } = await login(user.email);
      const auth = `Bearer ${accessToken}`;
      const executor = await signedInUser('Kenan Mehić');
      const { id: listingId } = await postListing(auth);
      await http()
        .post(`/api/listings/${listingId}/photos`)
        .set('Authorization', auth)
        .attach(
          'photo',
          await sharp({
            create: {
              width: 800,
              height: 600,
              channels: 3,
              background: '#fff',
            },
          })
            .jpeg()
            .toBuffer(),
          { filename: 'a.jpg', contentType: 'image/jpeg' },
        )
        .expect(201);
      await http()
        .put('/api/auth/me/avatar')
        .set('Authorization', auth)
        .attach(
          'photo',
          await sharp({
            create: {
              width: 300,
              height: 300,
              channels: 3,
              background: '#fff',
            },
          })
            .png()
            .toBuffer(),
          'ja.png',
        )
        .expect(200);
      expect(storage.files.size).toBe(3);
      await http()
        .post('/api/conversations')
        .set('Authorization', executor.auth)
        .send({ listingId })
        .expect(200);
      const otherJob = await postListing(executor.auth);

      const wrong = await deleteAccount(auth, 'not-the-password').expect(400);
      expect(wrong.body).toMatchObject({ code: 'WRONG_PASSWORD' });
      expect(await prisma.user.count()).toBe(2);

      const deleted = await deleteAccount(auth, PASSWORD).expect(204);

      expect(setCookieHeader(deleted)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(await prisma.user.findUnique({ where: { id: user.id } })).toBe(
        null,
      );
      expect(await prisma.listing.count()).toBe(1);
      expect(await prisma.conversation.count()).toBe(0);
      expect(storage.files.size).toBe(0);
      await me(accessToken).expect(401);
      await refresh(cookie).expect(401);
      await http()
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      // Other users keep their own data.
      await http().get(`/api/listings/${otherJob.id}`).expect(200);
    });
  });
});
