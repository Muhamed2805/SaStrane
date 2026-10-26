import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

// The database is mocked: these tests cover the HTTP layer (routing,
// validation, error mapping) with the same setup the server uses.
const prisma = {
  $queryRaw: jest.fn<Promise<unknown>, []>(),
  user: {
    findUnique: jest.fn<Promise<unknown>, [input: unknown]>(),
    create: jest.fn<Promise<unknown>, [input: unknown]>(),
    update: jest.fn<Promise<unknown>, [input: unknown]>(),
  },
};

const validRegistration = {
  email: 'new.user@example.com',
  password: 'correct-horse-battery',
  fullName: 'New User',
  role: 'BOTH',
};

describe('App (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
  });

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

  it('GET / is not an endpoint', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });

  it('rejects unknown fields in a request body', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validRegistration, isAdmin: true })
      .expect(400);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects passwords that bcrypt would silently truncate', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
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
      .post('/auth/register')
      .send(validRegistration)
      .expect(409);
  });

  it('protects authenticated endpoints', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('issues an access token on login that /auth/me accepts', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Test User',
      role: 'BOTH',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash('correct-horse-battery', 4),
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
    };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'correct-horse-battery' })
      .expect(201);
    const { accessToken } = login.body as { accessToken: string };

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body).toMatchObject({ id: user.id, email: user.email });
  });
});
