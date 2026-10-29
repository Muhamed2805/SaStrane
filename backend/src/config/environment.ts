const MINIMUM_SECRET_LENGTH = 32;
const DEFAULT_JWT_EXPIRES_IN = '15m';

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
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    PORT: port,
    TRUST_PROXY_HOPS: trustProxyHops,
  };
}
