// The e2e suite replaces the database with a mock, but environment
// validation still needs these values. Real values (for example from CI)
// take precedence.
process.env.DATABASE_URL ??= 'postgresql://e2e:e2e@localhost:5432/sastrane_e2e';
process.env.JWT_SECRET ??= 'e2e-only-secret-with-at-least-32-characters';
process.env.NODE_ENV ??= 'test';
