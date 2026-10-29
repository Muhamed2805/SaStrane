import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { REFRESH_COOKIE_NAME } from './../src/auth/refresh-cookie';
import { ROTATION_GRACE_MS } from './../src/auth/sessions.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { createFakeSessionStore } from './fake-session-store';

const password = 'correct-horse-battery';
const user = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Test User',
  role: 'BOTH',
  emailVerifiedAt: new Date(),
  passwordHash: bcrypt.hashSync(password, 4),
  createdAt: new Date('2026-09-15T12:00:00.000Z'),
};
const publicUser = {
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  createdAt: user.createdAt,
};

const sessionStore = createFakeSessionStore(() => publicUser);

// The database is mocked: these tests cover the HTTP layer (routing,
// validation, cookies, error mapping) with the same setup the server uses.
const prisma = {
  $queryRaw: jest.fn<Promise<unknown>, []>(),
  $transaction: (input: unknown) =>
    Array.isArray(input)
      ? Promise.all(input)
      : (input as (tx: unknown) => Promise<unknown>)(prisma),
  user: {
    findUnique: jest.fn<Promise<unknown>, [input: unknown]>(),
    create: jest.fn<Promise<unknown>, [input: unknown]>(),
    update: jest.fn<Promise<unknown>, [input: unknown]>(),
  },
  session: sessionStore.session,
  refreshToken: sessionStore.refreshToken,
};

const validRegistration = {
  email: 'new.user@example.com',
  password,
  fullName: 'New User',
  role: 'BOTH',
};

function setCookieHeader(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const cookie = cookies.find((value) =>
    value.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );
  if (!cookie) throw new Error('Response did not set the refresh cookie');
  return cookie;
}

// The "name=value" part, as a browser would send it back.
function cookiePair(setCookie: string) {
  return setCookie.split(';')[0];
}

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

describe('App (e2e)', () => {
  const throttlerStorage = new ResettableThrottlerStorage();
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ThrottlerStorage)
      .useValue(throttlerStorage)
      .compile();

    app = configureApp(
      moduleFixture.createNestApplication<NestExpressApplication>(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStore.reset();
    throttlerStorage.reset();
  });

  async function login() {
    prisma.user.findUnique.mockResolvedValue(user);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('User-Agent', 'e2e-browser')
      .send({ email: user.email, password })
      .expect(200);

    return {
      response,
      accessToken: (response.body as { accessToken: string }).accessToken,
      cookie: cookiePair(setCookieHeader(response)),
    };
  }

  function refresh(cookie?: string) {
    const call = request(app.getHttpServer()).post('/api/auth/refresh');
    return cookie ? call.set('Cookie', cookie) : call;
  }

  function me(accessToken: string) {
    return request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  describe('routing', () => {
    it('GET /health reports a reachable database', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    });

    it('GET /health returns 503 when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await request(app.getHttpServer()).get('/health').expect(503);
    });

    it('serves the API only under /api', async () => {
      await request(app.getHttpServer()).get('/').expect(404);
      await request(app.getHttpServer()).get('/auth/me').expect(404);
      await request(app.getHttpServer()).get('/api/health').expect(404);
    });
  });

  describe('validation', () => {
    it('rejects unknown fields in a request body', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...validRegistration, isAdmin: true })
        .expect(400);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects passwords that bcrypt would silently truncate', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...validRegistration, password: 'a'.repeat(73) })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('Lozinka je preduga');
    });

    it('returns 409, not 500, when a parallel sign-up wins the race', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(409);
    });
  });

  describe('sessions', () => {
    it('protects authenticated endpoints', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('keeps the refresh token out of reach of page scripts', async () => {
      const { response, accessToken } = await login();

      expect(response.body).toEqual({
        user: { ...publicUser, createdAt: publicUser.createdAt.toISOString() },
        accessToken,
      });
      const setCookie = setCookieHeader(response);
      expect(setCookie).toMatch(/; HttpOnly/);
      expect(setCookie).toMatch(/; SameSite=Strict/);
      expect(setCookie).toMatch(/; Path=\/api\/auth(;|$)/);
      expect(setCookie).toMatch(/; Expires=/);
      expect(sessionStore.sessions).toEqual([
        expect.objectContaining({ userId: user.id, userAgent: 'e2e-browser' }),
      ]);
    });

    it('issues an access token that /api/auth/me accepts', async () => {
      const { accessToken } = await login();
      prisma.user.findUnique.mockResolvedValue(publicUser);

      const response = await me(accessToken).expect(200);

      expect(response.body).toMatchObject({ id: user.id, email: user.email });
    });

    it('rotates the refresh cookie and keeps the session', async () => {
      const { cookie } = await login();

      const refreshed = await refresh(cookie).expect(200);
      const nextCookie = cookiePair(setCookieHeader(refreshed));
      const { accessToken } = refreshed.body as { accessToken: string };

      expect(nextCookie).not.toBe(cookie);
      expect(refreshed.body).toMatchObject({ user: { id: user.id } });
      prisma.user.findUnique.mockResolvedValue(publicUser);
      await me(accessToken).expect(200);
      await refresh(nextCookie).expect(200);
      expect(sessionStore.sessions).toHaveLength(1);
    });

    it('answers a concurrent refresh with the same cookie without rotating again', async () => {
      const { cookie } = await login();
      await refresh(cookie).expect(200);

      const second = await refresh(cookie).expect(200);

      expect(second.headers['set-cookie']).toBeUndefined();
      expect(second.body).toHaveProperty('accessToken');
    });

    it('revokes the session when an old refresh cookie comes back', async () => {
      const { cookie, accessToken } = await login();
      const refreshed = await refresh(cookie).expect(200);
      const currentCookie = cookiePair(setCookieHeader(refreshed));
      // Move the rotation outside the grace window.
      for (const token of sessionStore.refreshTokens) {
        if (token.rotatedAt) {
          token.rotatedAt = new Date(Date.now() - ROTATION_GRACE_MS - 1_000);
        }
      }

      const reuse = await refresh(cookie).expect(401);

      expect(setCookieHeader(reuse)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(sessionStore.sessions[0]).toMatchObject({
        revokedReason: 'TOKEN_REUSE',
      });
      // Whoever holds the newest cookie or an access token is out too.
      await refresh(currentCookie).expect(401);
      await me(accessToken).expect(401);
    });

    it('signs out immediately on logout', async () => {
      const { cookie, accessToken } = await login();

      const logout = await request(app.getHttpServer())
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
});
