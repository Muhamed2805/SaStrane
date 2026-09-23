const MINIMUM_SECRET_LENGTH = 32;

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

  const rawPort = config.PORT ?? 4000;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
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
    PORT: port,
  };
}
