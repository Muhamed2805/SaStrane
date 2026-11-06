// Makes a user an admin: `npm run admin -- amra@example.com`.
// Add --remove to take the right away. The change works at once, because
// the admin routes read the flag from the database.
import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Values already in the environment win over .env.
if (existsSync('.env')) process.loadEnvFile('.env');

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const email = args
  .find((arg) => !arg.startsWith('--'))
  ?.trim()
  .toLowerCase();
if (!email) {
  console.error('Usage: npm run admin -- <email> [--remove]');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const { count } = await prisma.user.updateMany({
    where: { email },
    data: { isAdmin: !remove },
  });
  if (count === 0) {
    console.error(`No user has the email ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(
      remove ? `${email} is no longer an admin.` : `${email} is an admin.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
