const MINIMUM_SECRET_LENGTH = 32;
const DEFAULT_JWT_EXPIRES_IN = '15m';
const DEFAULT_APP_URL = 'http://localhost:3000';

// The SeaweedFS container from docker-compose.yml. Used outside production
// when a storage variable is not set.
const LOCAL_STORAGE = {
  S3_ENDPOINT: 'http://localhost:8333',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'sastrane-photos',
  S3_ACCESS_KEY_ID: 'sastrane',
  S3_SECRET_ACCESS_KEY: 'sastrane-local-secret',
  S3_FORCE_PATH_STYLE: 'true',
  S3_PUBLIC_URL: 'http://localhost:8333/sastrane-photos',
};

// An explicit unit is required: jsonwebtoken reads a unitless string such as
// "900" as milliseconds, which would make every access token expire at once.
const JWT_EXPIRES_IN_PATTERN = /^[1-9]\d*(s|m|h|d)$/;

function requiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function validateDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }
}

// The web app's public address, used for links in emails. Returned without
// a trailing slash so paths can be appended.
function validateAppUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('APP_URL must be a valid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('APP_URL must use http or https');
  }
  return value.replace(/\/+$/, '');
}

function optionalString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validateHttpUrl(value: string, key: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${key} must use http or https`);
  }
  return value.replace(/\/+$/, '');
}

// Photo storage: any S3-compatible service, such as Cloudflare R2 or AWS S3.
// S3_PUBLIC_URL is where browsers read the files: the bucket's public
// address, which must allow anonymous reads. Also used by
// scripts/storage-init.ts.
export function validateStorage(
  config: Record<string, unknown>,
  isProduction: boolean,
) {
  type Key = keyof typeof LOCAL_STORAGE;
  // Required in production; the local default otherwise.
  const required = (key: Key) =>
    isProduction
      ? requiredString(config, key)
      : (optionalString(config, key) ?? LOCAL_STORAGE[key]);
  const optional = (key: Key) =>
    isProduction
      ? optionalString(config, key)
      : (optionalString(config, key) ?? LOCAL_STORAGE[key]);

  // Empty for AWS S3, where the SDK derives it from the region.
  const endpoint = optional('S3_ENDPOINT');
  if (endpoint) validateHttpUrl(endpoint, 'S3_ENDPOINT');

  const forcePathStyle = optional('S3_FORCE_PATH_STYLE') ?? 'false';
  if (forcePathStyle !== 'true' && forcePathStyle !== 'false') {
    throw new Error('S3_FORCE_PATH_STYLE must be true or false');
  }

  return {
    S3_ENDPOINT: endpoint,
    // Cloudflare R2 takes "auto"; AWS needs the bucket's region.
    S3_REGION: optional('S3_REGION') ?? 'auto',
    S3_BUCKET: required('S3_BUCKET'),
    S3_ACCESS_KEY_ID: required('S3_ACCESS_KEY_ID'),
    S3_SECRET_ACCESS_KEY: required('S3_SECRET_ACCESS_KEY'),
    S3_FORCE_PATH_STYLE: forcePathStyle === 'true',
    S3_PUBLIC_URL: validateHttpUrl(required('S3_PUBLIC_URL'), 'S3_PUBLIC_URL'),
  };
}

function validateSecret(value: string, key: string) {
  if (value.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(`${key} must contain at least 32 characters`);
  }
}

export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv =
    typeof config.NODE_ENV === 'string' && config.NODE_ENV.trim()
      ? config.NODE_ENV.trim()
      : 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const databaseUrl = requiredString(config, 'DATABASE_URL');
  validateDatabaseUrl(databaseUrl);

  const jwtSecret = requiredString(config, 'JWT_SECRET');

  const jwtExpiresIn =
    typeof config.JWT_EXPIRES_IN === 'string' && config.JWT_EXPIRES_IN.trim()
      ? config.JWT_EXPIRES_IN.trim()
      : DEFAULT_JWT_EXPIRES_IN;
  if (!JWT_EXPIRES_IN_PATTERN.test(jwtExpiresIn)) {
    throw new Error(
      'JWT_EXPIRES_IN must be a positive number followed by s, m, h, or d (for example 15m)',
    );
  }

  const rawPort = config.PORT ?? 4000;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  // Too high a value lets clients fake their IP and dodge rate limits; too
  // low a value makes all users share the proxy's IP.
  const rawTrustProxyHops =
    typeof config.TRUST_PROXY_HOPS === 'string' &&
    config.TRUST_PROXY_HOPS.trim()
      ? config.TRUST_PROXY_HOPS.trim()
      : nodeEnv === 'production'
        ? '1'
        : '0';
  const trustProxyHops = Number(rawTrustProxyHops);
  if (
    !Number.isInteger(trustProxyHops) ||
    trustProxyHops < 0 ||
    trustProxyHops > 10
  ) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }

  if (nodeEnv === 'production') {
    validateSecret(jwtSecret, 'JWT_SECRET');
    requiredString(config, 'CORS_ORIGINS');
    requiredString(config, 'RESEND_API_KEY');
    requiredString(config, 'EMAIL_FROM');
    const emailSecret = requiredString(config, 'EMAIL_VERIFICATION_SECRET');
    validateSecret(emailSecret, 'EMAIL_VERIFICATION_SECRET');
    requiredString(config, 'APP_URL');
  }

  const appUrl = validateAppUrl(
    typeof config.APP_URL === 'string' && config.APP_URL.trim()
      ? config.APP_URL.trim()
      : DEFAULT_APP_URL,
  );
  const storage = validateStorage(config, nodeEnv === 'production');

  return {
    ...config,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    PORT: port,
    TRUST_PROXY_HOPS: trustProxyHops,
    APP_URL: appUrl,
    ...storage,
  };
}
