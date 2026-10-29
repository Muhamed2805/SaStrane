import { TEST_DATABASE_URL } from './test-database';

// Runs before each e2e test file. Values set here win over backend/.env.
// The app always uses the test database, even when the shell or .env sets
// DATABASE_URL to another one.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET ??= 'e2e-only-secret-with-at-least-32-characters';
process.env.NODE_ENV ??= 'test';
// The tests replace the email service, and a real key must not leak in from
// .env either.
process.env.RESEND_API_KEY = '';
