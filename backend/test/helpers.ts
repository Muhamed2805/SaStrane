import bcrypt from 'bcrypt';
import request from 'supertest';
import { REFRESH_COOKIE_NAME } from '../src/auth/refresh-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabaseName } from './test-database.js';

export const PASSWORD = 'correct-horse-battery';
// bcrypt's lowest cost keeps the tests fast; login accepts any cost.
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export async function resetDatabase(prisma: PrismaService) {
  const [{ name }] = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  assertTestDatabaseName(name);
  await prisma.$executeRaw`TRUNCATE "Report", "Notification", "Invitation", "SavedListing", "ListingPhoto", "Rating", "ClientRating", "Message", "Conversation", "Application", "Listing", "RefreshToken", "Session", "User" CASCADE`;
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

// Stands in for StorageService and keeps the files in memory.
export class MemoryStorageService {
  readonly files = new Map<string, { body: Buffer; contentType: string }>();

  url(key: string) {
    return `https://photos.test/${key}`;
  }

  put(key: string, body: Buffer, contentType: string) {
    this.files.set(key, { body, contentType });
    return Promise.resolve();
  }

  delete(keys: string[]) {
    for (const key of keys) this.files.delete(key);
    return Promise.resolve();
  }

  clear() {
    this.files.clear();
  }
}

// Stands in for EmailService and keeps the emails it was asked to send.
export class CapturingEmailService {
  private readonly sent: { kind: string; email: string; code: string }[] = [];
  readonly decisions: {
    email: string;
    listingId: string;
    listingTitle: string;
    clientName: string;
    accepted: boolean;
  }[] = [];
  readonly passwordChanges: string[] = [];
  readonly newApplications: {
    email: string;
    listingTitle: string;
    executorName: string;
  }[] = [];
  readonly unreadMessages: {
    email: string;
    conversationId: string;
    senderName: string;
    unreadCount: number;
    lastMessage: string;
  }[] = [];
  readonly invitations: {
    email: string;
    listingId: string;
    listingTitle: string;
    clientName: string;
  }[] = [];

  sendVerificationCode(input: { email: string; code: string }) {
    this.sent.push({ kind: 'verification', ...input });
    return Promise.resolve();
  }

  sendPasswordResetCode(input: { email: string; code: string }) {
    this.sent.push({ kind: 'password-reset', ...input });
    return Promise.resolve();
  }

  sendApplicationDecision(input: {
    email: string;
    listingId: string;
    listingTitle: string;
    clientName: string;
    accepted: boolean;
  }) {
    const { email, listingId, listingTitle, clientName, accepted } = input;
    this.decisions.push({
      email,
      listingId,
      listingTitle,
      clientName,
      accepted,
    });
    return Promise.resolve();
  }

  sendNewApplication(input: {
    email: string;
    listingTitle: string;
    executorName: string;
  }) {
    const { email, listingTitle, executorName } = input;
    this.newApplications.push({ email, listingTitle, executorName });
    return Promise.resolve();
  }

  sendUnreadMessages(input: {
    email: string;
    conversationId: string;
    senderName: string;
    unreadCount: number;
    lastMessage: string;
  }) {
    const { email, conversationId, senderName, unreadCount, lastMessage } =
      input;
    this.unreadMessages.push({
      email,
      conversationId,
      senderName,
      unreadCount,
      lastMessage,
    });
    return Promise.resolve();
  }

  sendInvitation(input: {
    email: string;
    listingId: string;
    listingTitle: string;
    clientName: string;
  }) {
    const { email, listingId, listingTitle, clientName } = input;
    this.invitations.push({ email, listingId, listingTitle, clientName });
    return Promise.resolve();
  }

  sendPasswordChanged(input: { email: string }) {
    this.passwordChanges.push(input.email);
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
    this.decisions.length = 0;
    this.passwordChanges.length = 0;
    this.newApplications.length = 0;
    this.unreadMessages.length = 0;
    this.invitations.length = 0;
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
