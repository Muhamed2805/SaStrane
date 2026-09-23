import { validateEnvironment } from './environment';

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/sastrane',
  JWT_SECRET: 'a-secure-jwt-secret-with-at-least-32-characters',
};

describe('validateEnvironment', () => {
  it('applies safe development defaults', () => {
    expect(validateEnvironment(validEnvironment)).toEqual(
      expect.objectContaining({
        NODE_ENV: 'development',
        PORT: 4000,
      }),
    );
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: 'https://example.com/database',
      }),
    ).toThrow('DATABASE_URL must use the PostgreSQL protocol');
  });

  it('rejects a weak JWT secret', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        JWT_SECRET: 'too-short',
      }),
    ).toThrow('JWT_SECRET must contain at least 32 characters');
  });

  it('requires email and CORS configuration in production', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'production' }),
    ).toThrow('CORS_ORIGINS is required');

    expect(
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://sastrane.example',
        RESEND_API_KEY: 'resend-key',
        EMAIL_FROM: 'SaStrane <noreply@sastrane.example>',
        EMAIL_VERIFICATION_SECRET:
          'a-separate-email-secret-with-at-least-32-characters',
      }),
    ).toEqual(expect.objectContaining({ NODE_ENV: 'production' }));
  });
});
