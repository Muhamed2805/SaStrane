import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SessionRevocationReason } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_USER_SELECT, type PublicUser } from './public-user';

const DAY_MS = 24 * 60 * 60 * 1000;

// A session ends after this time even when it is used every day.
export const SESSION_MAX_AGE_MS = 90 * DAY_MS;
// A refresh token that is not used within this time expires. Each refresh
// issues a new token, so an active session stays signed in.
export const REFRESH_TOKEN_IDLE_TTL_MS = 30 * DAY_MS;
// Two requests can present the same token at once, for example when the
// response that carries the new cookie is still on its way. A rotated token
// is therefore accepted for a short time, without issuing another token.
export const ROTATION_GRACE_MS = 30 * 1000;
// Revoked sessions are kept for a while to help investigate incidents.
const REVOKED_SESSION_RETENTION_MS = 30 * DAY_MS;

export type IssuedRefreshToken = { value: string; expiresAt: Date };

export type SessionGrant = {
  sessionId: string;
  user: PublicUser;
  // null when another request already rotated the presented token: the
  // client keeps the cookie that request set.
  refreshToken: IssuedRefreshToken | null;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(now: Date, sessionExpiresAt: Date) {
  const value = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Math.min(
      now.getTime() + REFRESH_TOKEN_IDLE_TTL_MS,
      sessionExpiresAt.getTime(),
    ),
  );
  return { value, hash: hashToken(value), expiresAt };
}

class RotationConflict extends Error {}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    userAgent?: string,
  ): Promise<{ sessionId: string; refreshToken: IssuedRefreshToken }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);
    const token = newRefreshToken(now, expiresAt);

    const [, session] = await this.prisma.$transaction([
      // Housekeeping: remove this user's sessions that can no longer be used.
      this.prisma.session.deleteMany({
        where: {
          userId,
          OR: [
            { expiresAt: { lte: now } },
            {
              revokedAt: {
                lte: new Date(now.getTime() - REVOKED_SESSION_RETENTION_MS),
              },
            },
          ],
        },
      }),
      this.prisma.session.create({
        data: {
          userId,
          userAgent: userAgent?.slice(0, 512),
          expiresAt,
          refreshTokens: {
            create: { tokenHash: token.hash, expiresAt: token.expiresAt },
          },
        },
        select: { id: true },
      }),
    ]);

    return {
      sessionId: session.id,
      refreshToken: { value: token.value, expiresAt: token.expiresAt },
    };
  }

  // Exchanges a refresh token for a new one. Returns null when the token
  // cannot be used; the caller then treats the client as signed out.
  async rotate(rawToken: string): Promise<SessionGrant | null> {
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: {
        id: true,
        expiresAt: true,
        rotatedAt: true,
        session: {
          select: {
            id: true,
            expiresAt: true,
            revokedAt: true,
            user: { select: PUBLIC_USER_SELECT },
          },
        },
      },
    });

    if (!stored || stored.expiresAt <= now) return null;
    const { session } = stored;
    if (session.revokedAt || session.expiresAt <= now) return null;

    const grant = { sessionId: session.id, user: session.user };

    if (stored.rotatedAt) {
      if (now.getTime() - stored.rotatedAt.getTime() <= ROTATION_GRACE_MS) {
        return { ...grant, refreshToken: null };
      }

      // The legitimate client always holds the newest token, so an old one
      // was copied. Ending the session also locks out whoever copied it.
      await this.revoke(session.id, SessionRevocationReason.TOKEN_REUSE);
      this.logger.warn(
        `Revoked session ${session.id}: a rotated refresh token was used again`,
      );
      return null;
    }

    const next = newRefreshToken(now, session.expiresAt);
    try {
      await this.prisma.$transaction(async (tx) => {
        // Only one request can claim the token. A concurrent request that
        // loses the race gets the grace result below.
        const claimed = await tx.refreshToken.updateMany({
          where: { id: stored.id, rotatedAt: null },
          data: { rotatedAt: now },
        });
        if (claimed.count !== 1) throw new RotationConflict();

        await tx.refreshToken.create({
          data: {
            sessionId: session.id,
            tokenHash: next.hash,
            expiresAt: next.expiresAt,
          },
        });
        await tx.refreshToken.deleteMany({
          where: { sessionId: session.id, expiresAt: { lte: now } },
        });
        await tx.session.update({
          where: { id: session.id },
          data: { lastUsedAt: now },
        });
      });
    } catch (error) {
      if (error instanceof RotationConflict) {
        return { ...grant, refreshToken: null };
      }
      throw error;
    }

    return {
      ...grant,
      refreshToken: { value: next.value, expiresAt: next.expiresAt },
    };
  }

  async revokeByRefreshToken(rawToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { sessionId: true },
    });
    if (stored) {
      await this.revoke(stored.sessionId, SessionRevocationReason.LOGOUT);
    }
  }

  async revoke(sessionId: string, reason: SessionRevocationReason) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  // Accepts a transaction client so it can run together with the change
  // that requires it, such as a password reset.
  async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async isActive(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    return session !== null;
  }
}
