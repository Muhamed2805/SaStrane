// The app validates its configuration at startup, although the OpenAPI
// document does not depend on it. These values let the generator run
// without a .env file. Values that are already set win.
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL ??= 'postgresql://openapi@localhost:5432/openapi';
process.env.JWT_SECRET ??= 'openapi-generator-only-secret-0123456789';
