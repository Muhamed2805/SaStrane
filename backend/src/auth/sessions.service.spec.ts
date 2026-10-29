import { SessionRevocationReason } from '../generated/prisma/enums';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  REFRESH_TOKEN_IDLE_TTL_MS,
  ROTATION_GRACE_MS,
  SESSION_MAX_AGE_MS,
  SessionsService,
} from './sessions.service';

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
    create: jest.fn<Promise<unknown>, Call>(),
    deleteMany: jest.fn<Promise<unknown>, Call>(),
    findFirst: jest.fn<Promise<unknown>, Call>(),
    update: jest.fn<Promise<unknown>, Call>(),
    updateMany: jest.fn<Promise<{ count: number }>, Call>(),
  };
  const refreshTokenRepository = {
    create: jest.fn<Promise<unknown>, Call>(),
    deleteMany: jest.fn<Promise<unknown>, Call>(),
    findUnique: jest.fn<Promise<unknown>, Call>(),
    updateMany: jest.fn<Promise<{ count: number }>, Call>(),
  };
  type TransactionInput =
    Promise<unknown>[] | ((tx: unknown) => Promise<unknown>);
  const prisma = {
    session: sessionRepository,
    refreshToken: refreshTokenRepository,
    $transaction: jest.fn<Promise<unknown>, [input: TransactionInput]>(),
  };
  const runTransaction = (input: TransactionInput) =>
    Array.isArray(input) ? Promise.all(input) : input(prisma);

  const service = new SessionsService(prisma as unknown as PrismaService);

  // A stored token as rotate() reads it, with a valid, active session.
  function storedToken(
    overrides: { expiresAt?: Date; rotatedAt?: Date | null } = {},
    session: { expiresAt?: Date; revokedAt?: Date | null } = {},
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
        user,
        ...session,
      },
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(now);
    prisma.$transaction.mockImplementation(runTransaction);
    sessionRepository.updateMany.mockResolvedValue({ count: 1 });
    refreshTokenRepository.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('treats only an unrevoked, unexpired session of the user as active', async () => {
    sessionRepository.findFirst.mockResolvedValue({ id: 'session-1' });

    await expect(service.isActive('session-1', user.id)).resolves.toBe(true);

    expect(sessionRepository.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });

    sessionRepository.findFirst.mockResolvedValue(null);
    await expect(service.isActive('session-1', user.id)).resolves.toBe(false);
  });
});
