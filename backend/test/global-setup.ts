import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { assertTestDatabaseName, TEST_DATABASE_URL } from './test-database';

const backendDir = join(__dirname, '..');

async function createDatabaseIfMissing(url: URL, name: string) {
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: maintenanceUrl.toString(),
      connectionTimeoutMillis: 5_000,
    }),
  });

  try {
    const existing = await prisma.$queryRaw<
      unknown[]
    >`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    // The name is checked against a strict pattern, so quoting it is safe.
    if (existing.length === 0) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    }
  } catch (error) {
    throw new Error(
      `Cannot prepare the e2e database on ${url.host}. Start PostgreSQL with ` +
        '"docker compose up -d" in the repository root, or set TEST_DATABASE_URL.',
      { cause: error },
    );
  } finally {
    await prisma.$disconnect();
  }
}

function applyMigrations() {
  try {
    execFileSync(
      process.execPath,
      [
        join(backendDir, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
      ],
      {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      },
    );
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `prisma migrate deploy failed for the e2e database:\n${String(stdout ?? '')}${String(stderr ?? '')}`,
    );
  }
}

// Runs once before all e2e test files.
export default async function globalSetup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1));
  assertTestDatabaseName(name);

  await createDatabaseIfMissing(url, name);
  applyMigrations();
}
