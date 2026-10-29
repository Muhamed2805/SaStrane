// Points the app at a port where nothing listens. This import must come
// before AppModule, which reads the environment when it is loaded.
import './use-unreachable-database';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('App with the database down (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleFixture.createNestApplication<NestExpressApplication>(),
    );
    // The pg adapter connects on the first query, so the app still starts.
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the database as down on /health', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body).toMatchObject({ database: 'down' });
  });

  it.each([
    ['GET', '/api/listings', undefined],
    [
      'POST',
      '/api/auth/login',
      { email: 'user@example.com', password: 'correct-horse-battery' },
    ],
  ])('answers %s %s with 503 instead of 500', async (method, path, body) => {
    const call =
      method === 'GET'
        ? request(app.getHttpServer()).get(path)
        : request(app.getHttpServer()).post(path).send(body);

    const response = await call.expect(503);

    expect(response.body).toMatchObject({ message: 'Database unavailable' });
  });
});
