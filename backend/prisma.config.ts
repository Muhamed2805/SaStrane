import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env. Values already in the environment win.
if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Run with `npx prisma db seed`. Prisma 7 no longer seeds after
    // `migrate dev` or `migrate reset`.
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  // `prisma generate` needs no database, so a missing URL only fails the
  // commands that connect.
  ...(url ? { datasource: { url } } : {}),
});
