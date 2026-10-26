import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';

// Regression test: the JWT secret used to be read from process.env while the
// module file was imported, before ConfigModule had loaded .env. Signing then
// failed with "secretOrPrivateKey must have a value" unless something else
// happened to load .env first.
describe('AuthModule', () => {
  const savedSecret = process.env.JWT_SECRET;
  const savedExpiresIn = process.env.JWT_EXPIRES_IN;

  beforeAll(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });

  afterAll(() => {
    if (savedSecret !== undefined) process.env.JWT_SECRET = savedSecret;
    if (savedExpiresIn !== undefined) {
      process.env.JWT_EXPIRES_IN = savedExpiresIn;
    }
  });

  it('signs tokens with the secret and lifetime from configuration', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'config-only-secret-with-at-least-32-chars',
              JWT_EXPIRES_IN: '15m',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const jwt = moduleRef.get(JwtService);
    const token = await jwt.signAsync({ sub: 'user-1' });
    const payload = await jwt.verifyAsync<{
      sub: string;
      iat: number;
      exp: number;
    }>(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });
});
