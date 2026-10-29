import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { REFRESH_COOKIE_NAME } from '../src/auth/refresh-cookie';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabaseName } from './test-database';

export const PASSWORD = 'correct-horse-battery';
// bcrypt's lowest cost keeps the tests fast; login accepts any cost.
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export async function resetDatabase(prisma: PrismaService) {
  const [{ name }] = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  assertTestDatabaseName(name);
  await prisma.$executeRaw`TRUNCATE "Application", "Listing", "RefreshToken", "Session", "User" CASCADE`;
}

let userCount = 0;

// A user who has confirmed their email and can sign in with PASSWORD.
export function createUser(
  prisma: PrismaService,
  overrides: { email?: string; fullName?: string } = {},
) {
  userCount += 1;
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${userCount}@example.com`,
      fullName: overrides.fullName ?? `Test User ${userCount}`,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
}

// Stands in for EmailService and keeps the codes it was asked to send.
export class CapturingEmailService {
  private readonly sent: { kind: string; email: string; code: string }[] = [];

  sendVerificationCode(input: { email: string; code: string }) {
    this.sent.push({ kind: 'verification', ...input });
    return Promise.resolve();
  }

  sendPasswordResetCode(input: { email: string; code: string }) {
    this.sent.push({ kind: 'password-reset', ...input });
    return Promise.resolve();
  }

  lastCode(kind: 'verification' | 'password-reset', email: string) {
    const message = this.sent
      .filter((item) => item.kind === kind && item.email === email)
      .at(-1);
    if (!message) throw new Error(`No ${kind} email was sent to ${email}`);
    return message.code;
  }

  clear() {
    this.sent.length = 0;
  }
}

export function setCookieHeader(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const cookie = cookies.find((value) =>
    value.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );
  if (!cookie) throw new Error('Response did not set the refresh cookie');
  return cookie;
}

// The "name=value" part, as a browser would send it back.
export function cookiePair(setCookie: string) {
  return setCookie.split(';')[0];
}
