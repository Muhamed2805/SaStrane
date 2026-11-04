import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/sastrane',
  JWT_SECRET: 'a-secure-jwt-secret-with-at-least-32-characters',
};

const productionEnvironment = {
  ...validEnvironment,
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://sastrane.example',
  RESEND_API_KEY: 'resend-key',
  EMAIL_FROM: 'SaStrane <noreply@sastrane.example>',
  EMAIL_VERIFICATION_SECRET:
    'a-separate-email-secret-with-at-least-32-characters',
  APP_URL: 'https://sastrane.example',
  S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  S3_BUCKET: 'sastrane-photos',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  S3_PUBLIC_URL: 'https://photos.sastrane.example/',
};

describe('validateEnvironment', () => {
  it('applies safe development defaults', () => {
    expect(validateEnvironment(validEnvironment)).toEqual(
      expect.objectContaining({
        NODE_ENV: 'development',
        PORT: 4000,
        JWT_EXPIRES_IN: '15m',
        TRUST_PROXY_HOPS: 0,
      }),
    );
  });

  it('accepts a JWT lifetime with an explicit unit', () => {
    expect(
      validateEnvironment({ ...validEnvironment, JWT_EXPIRES_IN: ' 30m ' }),
    ).toEqual(expect.objectContaining({ JWT_EXPIRES_IN: '30m' }));
  });

  it.each(['900', '15 minutes', '0m', '-5m', '15M'])(
    'rejects the JWT lifetime %p',
    (value) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, JWT_EXPIRES_IN: value }),
      ).toThrow('JWT_EXPIRES_IN must be a positive number');
    },
  );

  it('reads the number of trusted proxy hops', () => {
    expect(
      validateEnvironment({ ...validEnvironment, TRUST_PROXY_HOPS: ' 2 ' }),
    ).toEqual(expect.objectContaining({ TRUST_PROXY_HOPS: 2 }));
  });

  it.each(['-1', '1.5', 'yes', '11'])(
    'rejects the trusted proxy hop count %p',
    (value) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, TRUST_PROXY_HOPS: value }),
      ).toThrow('TRUST_PROXY_HOPS must be an integer between 0 and 10');
    },
  );

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
        APP_URL: 'https://sastrane.example/',
        S3_BUCKET: 'sastrane-photos',
        S3_ACCESS_KEY_ID: 'access-key',
        S3_SECRET_ACCESS_KEY: 'secret-key',
        S3_PUBLIC_URL: 'https://photos.sastrane.example',
      }),
    ).toEqual(
      expect.objectContaining({
        NODE_ENV: 'production',
        TRUST_PROXY_HOPS: 1,
        APP_URL: 'https://sastrane.example',
      }),
    );
  });

  it('requires the web app URL in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://sastrane.example',
        RESEND_API_KEY: 'resend-key',
        EMAIL_FROM: 'SaStrane <noreply@sastrane.example>',
        EMAIL_VERIFICATION_SECRET:
          'a-separate-email-secret-with-at-least-32-characters',
      }),
    ).toThrow('APP_URL is required');
  });

  it('defaults the web app URL outside production and checks it', () => {
    expect(validateEnvironment(validEnvironment)).toEqual(
      expect.objectContaining({ APP_URL: 'http://localhost:3000' }),
    );
    expect(() =>
      validateEnvironment({ ...validEnvironment, APP_URL: 'ftp://x.example' }),
    ).toThrow('APP_URL must use http or https');
    expect(() =>
      validateEnvironment({ ...validEnvironment, APP_URL: 'not a url' }),
    ).toThrow('APP_URL must be a valid URL');
  });

  it('uses the local SeaweedFS storage outside production', () => {
    expect(validateEnvironment(validEnvironment)).toEqual(
      expect.objectContaining({
        S3_ENDPOINT: 'http://localhost:8333',
        S3_BUCKET: 'sastrane-photos',
        S3_FORCE_PATH_STYLE: true,
        S3_PUBLIC_URL: 'http://localhost:8333/sastrane-photos',
      }),
    );
  });

  it('requires the photo storage in production, without local defaults', () => {
    expect(validateEnvironment(productionEnvironment)).toEqual(
      expect.objectContaining({
        S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        S3_REGION: 'auto',
        S3_FORCE_PATH_STYLE: false,
        S3_PUBLIC_URL: 'https://photos.sastrane.example',
      }),
    );

    for (const key of [
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_PUBLIC_URL',
    ]) {
      expect(() =>
        validateEnvironment({ ...productionEnvironment, [key]: '' }),
      ).toThrow(`${key} is required`);
    }

    // AWS S3 needs no endpoint.
    expect(
      validateEnvironment({ ...productionEnvironment, S3_ENDPOINT: '' }),
    ).toEqual(expect.objectContaining({ S3_ENDPOINT: undefined }));
  });

  it('checks the storage URLs and the path style flag', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, S3_PUBLIC_URL: 'nope' }),
    ).toThrow('S3_PUBLIC_URL must be a valid URL');
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        S3_ENDPOINT: 'ftp://x.example',
      }),
    ).toThrow('S3_ENDPOINT must use http or https');
    expect(() =>
      validateEnvironment({ ...validEnvironment, S3_FORCE_PATH_STYLE: 'yes' }),
    ).toThrow('S3_FORCE_PATH_STYLE must be true or false');
  });
});
