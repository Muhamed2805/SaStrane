import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRevocationReason } from '../generated/prisma/enums.js';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  REFRESH_TOKEN_IDLE_TTL_MS,
  ROTATION_GRACE_MS,
  SESSION_MAX_AGE_MS,
  SessionsService,
} from './sessions.service.js';

type Call = [input: unknown];

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('SessionsService', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'BOTH',
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
  };

  const sessionRepository = {
    create: vi.fn<(...args: Call) => Promise<unknown>>(),
    deleteMany: vi.fn<(...args: Call) => Promise<unknown>>(),
    findFirst: vi.fn<(...args: Call) => Promise<unknown>>(),
    update: vi.fn<(...args: Call) => Promise<unknown>>(),
    updateMany: vi.fn<(...args: Call) => Promise<{ count: number }>>(),
  };
  const refreshTokenRepository = {
    create: vi.fn<(...args: Call) => Promise<unknown>>(),
    deleteMany: vi.fn<(...args: Call) => Promise<unknown>>(),
    findUnique: vi.fn<(...args: Call) => Promise<unknown>>(),
    updateMany: vi.fn<(...args: Call) => Promise<{ count: number }>>(),
  };
  type TransactionInput =
    Promise<unknown>[] | ((tx: unknown) => Promise<unknown>);
  const prisma = {
    session: sessionRepository,
    refreshToken: refreshTokenRepository,
    $transaction: vi.fn<(input: TransactionInput) => Promise<unknown>>(),
  };
  const runTransaction = (input: TransactionInput) =>
    Array.isArray(input) ? Promise.all(input) : input(prisma);

  const service = new SessionsService(prisma as unknown as PrismaService);

  // A stored token as rotate() reads it, with a valid, active session.
  function storedToken(
    overrides: { expiresAt?: Date; rotatedAt?: Date | null } = {},
    session: {
      expiresAt?: Date;
      revokedAt?: Date | null;
      user?: typeof user & { suspendedAt: Date | null };
    } = {},
  ) {
    return {
      id: 'token-1',
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL_MS),
      rotatedAt: null,
      ...overrides,
      session: {
        id: 'session-1',
        expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS),
        revokedAt: null,
        user: { ...user, suspendedAt: null },
        ...session,
      },
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    prisma.$transaction.mockImplementation(runTransaction);
    sessionRepository.updateMany.mockResolvedValue({ count: 1 });
    refreshTokenRepository.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('stores only a hash of a random refresh token', async () => {
      sessionRepository.create.mockResolvedValue({ id: 'session-1' });

      const result = await service.create(user.id, 'Test Browser');

      expect(result.sessionId).toBe('session-1');
      expect(result.refreshToken.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(result.refreshToken.expiresAt).toEqual(
        new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL_MS),
      );
      expect(sessionRepository.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          userAgent: 'Test Browser',
          expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS),
          refreshTokens: {
            create: {
              tokenHash: sha256(result.refreshToken.value),
              expiresAt: result.refreshToken.expiresAt,
            },
          },
        },
        select: { id: true },
      });
    });

    it('removes sessions of the same user that can no longer be used', async () => {
      sessionRepository.create.mockResolvedValue({ id: 'session-1' });

      await service.create(user.id);

      expect(sessionRepository.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          OR: [
            { expiresAt: { lte: now } },
            { revokedAt: { lte: expect.any(Date) as unknown } },
          ],
        },
      });
    });

    it('limits the stored user agent length', async () => {
      sessionRepository.create.mockResolvedValue({ id: 'session-1' });

      await service.create(user.id, 'x'.repeat(2_000));

      const input = sessionRepository.create.mock.calls[0][0] as {
        data: { userAgent: string };
      };
      expect(input.data.userAgent).toHaveLength(512);
    });
  });

  describe('rotate', () => {
    it('replaces a valid token with a new one', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(storedToken());

      const grant = await service.rotate('current-token');

      expect(refreshTokenRepository.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: sha256('current-token') },
        }),
      );
      expect(grant).toEqual({
        sessionId: 'session-1',
        user,
        refreshToken: {
          value: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL_MS),
        },
      });
      // The claim only succeeds while the token has not been rotated yet.
      expect(refreshTokenRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1', rotatedAt: null },
        data: { rotatedAt: now },
      });
      expect(refreshTokenRepository.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          tokenHash: sha256(grant!.refreshToken!.value),
          expiresAt: grant!.refreshToken!.expiresAt,
        },
      });
      expect(sessionRepository.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { lastUsedAt: now },
      });
    });

    it('refuses the token of a suspended user', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(
        storedToken({}, { user: { ...user, suspendedAt: now } }),
      );

      await expect(service.rotate('current-token')).resolves.toBeNull();
      expect(refreshTokenRepository.updateMany).not.toHaveBeenCalled();
    });

    it('never lets a new token outlive its session', async () => {
      const sessionExpiresAt = new Date(now.getTime() + 60_000);
      refreshTokenRepository.findUnique.mockResolvedValue(
        storedToken({}, { expiresAt: sessionExpiresAt }),
      );

      const grant = await service.rotate('current-token');

      expect(grant?.refreshToken?.expiresAt).toEqual(sessionExpiresAt);
    });

    it.each([
      ['unknown', null],
      ['expired', storedToken({ expiresAt: now })],
      ['revoked-session', storedToken({}, { revokedAt: now })],
      ['expired-session', storedToken({}, { expiresAt: now })],
    ])('rejects a %s token', async (_case, stored) => {
      refreshTokenRepository.findUnique.mockResolvedValue(stored);

      await expect(service.rotate('some-token')).resolves.toBeNull();

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(sessionRepository.updateMany).not.toHaveBeenCalled();
    });

    it('accepts a token rotated moments ago without issuing another one', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(
        storedToken({ rotatedAt: new Date(now.getTime() - 5_000) }),
      );

      await expect(service.rotate('current-token')).resolves.toEqual({
        sessionId: 'session-1',
        user,
        refreshToken: null,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(sessionRepository.updateMany).not.toHaveBeenCalled();
    });

    it('revokes the session when an old token is used again', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(
        storedToken({
          rotatedAt: new Date(now.getTime() - ROTATION_GRACE_MS - 1),
        }),
      );

      await expect(service.rotate('stolen-token')).resolves.toBeNull();

      expect(sessionRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: SessionRevocationReason.TOKEN_REUSE,
        },
      });
      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('lets a request that loses a rotation race keep the current token', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(storedToken());
      refreshTokenRepository.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.rotate('current-token')).resolves.toEqual({
        sessionId: 'session-1',
        user,
        refreshToken: null,
      });

      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
      expect(sessionRepository.updateMany).not.toHaveBeenCalled();
    });

    it('passes database errors on', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(storedToken());
      refreshTokenRepository.create.mockRejectedValue(new Error('db down'));

      await expect(service.rotate('current-token')).rejects.toThrow('db down');
    });
  });

  describe('revokeByRefreshToken', () => {
    it('revokes the session that owns the token', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue({
        sessionId: 'session-1',
      });

      await service.revokeByRefreshToken('current-token');

      expect(refreshTokenRepository.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('current-token') },
        select: { sessionId: true },
      });
      expect(sessionRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: SessionRevocationReason.LOGOUT,
        },
      });
    });

    it('ignores an unknown token', async () => {
      refreshTokenRepository.findUnique.mockResolvedValue(null);

      await service.revokeByRefreshToken('unknown-token');

      expect(sessionRepository.updateMany).not.toHaveBeenCalled();
    });
  });

  it('revokes every active session of a user', async () => {
    await service.revokeAllForUser(
      user.id,
      SessionRevocationReason.PASSWORD_RESET,
    );

    expect(sessionRepository.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: {
        revokedAt: now,
        revokedReason: SessionRevocationReason.PASSWORD_RESET,
      },
    });
  });

  it('revokes the other sessions of a user and keeps the current one', async () => {
    await service.revokeOthers(
      user.id,
      'session-1',
      SessionRevocationReason.PASSWORD_CHANGE,
    );

    expect(sessionRepository.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, id: { not: 'session-1' }, revokedAt: null },
      data: {
        revokedAt: now,
        revokedReason: SessionRevocationReason.PASSWORD_CHANGE,
      },
    });
  });

  it('treats only an unrevoked, unexpired session of a user who is not suspended as active', async () => {
    sessionRepository.findFirst.mockResolvedValue({ id: 'session-1' });

    await expect(service.isActive('session-1', user.id)).resolves.toBe(true);

    expect(sessionRepository.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { suspendedAt: null },
      },
      select: { id: true },
    });

    sessionRepository.findFirst.mockResolvedValue(null);
    await expect(service.isActive('session-1', user.id)).resolves.toBe(false);
  });
});
