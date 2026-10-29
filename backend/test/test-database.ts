// The e2e tests empty every table before each test, so they use a database
// of their own, never DATABASE_URL. The default matches docker-compose.yml.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://sastrane:sastrane@localhost:5432/sastrane_test';

// A typo in TEST_DATABASE_URL must not wipe a real database.
export function assertTestDatabaseName(name: string) {
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to run e2e tests against database "${name}": its name must end with _test.`,
    );
  }
}
