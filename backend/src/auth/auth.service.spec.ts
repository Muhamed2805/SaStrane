import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SessionRevocationReason } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { UserRole } from './dto/register.dto';
import { EmailService } from './email.service';
import { SessionsService, type SessionGrant } from './sessions.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// bcrypt's functions are overloaded (callback and promise forms), so
// jest.mocked() would pick the callback form. Type the promise form directly.
const hashMock = bcrypt.hash as unknown as jest.Mock<
  Promise<string>,
  [data: string, rounds: number]
>;
const compareMock = bcrypt.compare as unknown as jest.Mock<
  Promise<boolean>,
  [data: string, encrypted: string]
>;

type EmailInput = { email: string; fullName: string; code: string };

describe('AuthService', () => {
  const userRepository = {
    create: jest.fn<Promise<unknown>, [input: unknown]>(),
    delete: jest.fn<Promise<unknown>, [input: unknown]>(),
    findUnique: jest.fn<Promise<unknown>, [input: unknown]>(),
    update: jest.fn<Promise<unknown>, [input: unknown]>(),
    updateMany: jest.fn<Promise<{ count: number }>, [input: unknown]>(),
  };
  const jwtService = {
    signAsync: jest.fn<Promise<string>, [payload: unknown]>(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EMAIL_VERIFICATION_SECRET') return 'verification-secret';
      if (key === 'JWT_SECRET') return 'jwt-secret';
      return undefined;
    }),
  };
  const emailService = {
    sendVerificationCode: jest.fn<Promise<void>, [input: EmailInput]>(),
    sendPasswordResetCode: jest.fn<Promise<void>, [input: EmailInput]>(),
  };
  const sessionsService = {
    create: jest.fn<
      ReturnType<SessionsService['create']>,
      Parameters<SessionsService['create']>
    >(),
    rotate: jest.fn<
      ReturnType<SessionsService['rotate']>,
      Parameters<SessionsService['rotate']>
    >(),
    revokeByRefreshToken: jest.fn<Promise<void>, [rawToken: string]>(),
    revokeAllForUser: jest.fn<
      Promise<void>,
      [userId: string, reason: SessionRevocationReason, db: unknown]
    >(),
  };
  type TransactionCallback = (tx: unknown) => Promise<unknown>;
  const prisma = {
    user: userRepository,
    $transaction: jest.fn<Promise<unknown>, [callback: TransactionCallback]>(),
  };
  // Interactive transactions run their callback with a client that behaves
  // like the main one.
  const runTransaction = (callback: TransactionCallback) => callback(prisma);

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwtService as unknown as JwtService,
    configService as unknown as ConfigService,
    emailService as unknown as EmailService,
    sessionsService as unknown as SessionsService,
  );

  const issuedRefreshToken = {
    value: 'new-refresh-token',
    expiresAt: new Date('2026-10-29T12:00:00.000Z'),
  };

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
    role: UserRole.BOTH,
    emailVerifiedAt: new Date('2026-09-15T12:00:00.000Z'),
    passwordHash: 'stored-password-hash',
    emailVerificationCodeHash: null,
    emailVerificationExpiresAt: null,
    emailVerificationSentAt: null,
    emailVerificationAttempts: 0,
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
    updatedAt: new Date('2026-09-15T12:00:00.000Z'),
  };

  const publicUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_VERIFICATION_SECRET') return 'verification-secret';
      if (key === 'JWT_SECRET') return 'jwt-secret';
      return undefined;
    });
    prisma.$transaction.mockImplementation(runTransaction);
    sessionsService.create.mockResolvedValue({
      sessionId: 'session-1',
      refreshToken: issuedRefreshToken,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('register', () => {
    it('normalizes the email, hashes the password, and sends a verification code', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
      userRepository.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('new-password-hash');
      userRepository.create.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(user);
      emailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'USER@EXAMPLE.COM',
        password: 'secure-password',
        fullName: 'Test User',
        role: UserRole.BOTH,
      });

      expect(userRepository.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        select: { id: true, emailVerifiedAt: true },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('secure-password', 12);
      // Mock call arguments are typed as `unknown`; narrow them immediately.
      const createInput = userRepository.create.mock.calls[0][0] as {
        data: {
          email: string;
          passwordHash: string;
          fullName: string;
          role: UserRole;
          emailVerificationCodeHash: string;
          emailVerificationExpiresAt: Date;
          emailVerificationSentAt: Date;
          emailVerificationAttempts: number;
        };
      };
      expect(createInput.data).toEqual(
        expect.objectContaining({
          email: 'user@example.com',
          passwordHash: 'new-password-hash',
          fullName: 'Test User',
          role: UserRole.BOTH,
          emailVerificationExpiresAt: new Date('2026-09-15T12:10:00.000Z'),
          emailVerificationSentAt: new Date('2026-09-15T12:00:00.000Z'),
          emailVerificationAttempts: 0,
        }),
      );
      const emailInput = emailService.sendVerificationCode.mock.calls[0][0] as {
        email: string;
        fullName: string;
        code: string;
      };
      expect(emailInput.email).toBe(user.email);
      expect(emailInput.fullName).toBe(user.fullName);
      expect(emailInput.code).toMatch(/^\d{6}$/);
      expect(createInput.data.emailVerificationCodeHash).toBe(
        createHmac('sha256', 'verification-secret')
          .update(`user@example.com:${emailInput.code}`)
          .digest('hex'),
      );
      expect(result).toEqual({
        email: user.email,
        verificationRequired: true,
        expiresInSeconds: 600,
      });
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects an email that is already registered', async () => {
      userRepository.findUnique.mockResolvedValue({
        id: user.id,
        emailVerifiedAt: user.emailVerifiedAt,
      });

      await expect(
        service.register({
          email: 'USER@EXAMPLE.COM',
          password: 'secure-password',
          fullName: 'Test User',
          role: UserRole.CLIENT,
        }),
      ).rejects.toThrow(ConflictException);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('removes the unverified account when email delivery fails', async () => {
      userRepository.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('new-password-hash');
      userRepository.create.mockResolvedValue(user);
      emailService.sendVerificationCode.mockRejectedValue(
        new Error('email provider unavailable'),
      );
      userRepository.delete.mockResolvedValue(user);

      await expect(
        service.register({
          email: user.email,
          password: 'secure-password',
          fullName: user.fullName,
          role: UserRole.BOTH,
        }),
      ).rejects.toThrow('email provider unavailable');

      expect(userRepository.delete).toHaveBeenCalledWith({
        where: { id: user.id },
      });
    });
  });

  describe('login', () => {
    it('returns a safe user response and starts a new session', async () => {
      userRepository.findUnique.mockResolvedValue(user);
      compareMock.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.login(
        {
          email: 'USER@EXAMPLE.COM',
          password: 'secure-password',
        },
        'Test Browser',
      );

      expect(userRepository.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'secure-password',
        user.passwordHash,
      );
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(sessionsService.create).toHaveBeenCalledWith(
        user.id,
        'Test Browser',
      );
      // The session id lets every request check that the session is active.
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        sid: 'session-1',
        email: user.email,
        role: user.role,
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe(issuedRefreshToken);
    });

    it('rejects an unknown email without comparing a password', async () => {
      userRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'secure-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects an invalid password without issuing tokens', async () => {
      userRepository.findUnique.mockResolvedValue(user);
      compareMock.mockResolvedValue(false);

      await expect(
        service.login({
          email: user.email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(sessionsService.create).not.toHaveBeenCalled();
    });

    it('rejects a valid password until the email is verified', async () => {
      userRepository.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: null,
      });
      compareMock.mockResolvedValue(true);

      await expect(
        service.login({
          email: user.email,
          password: 'secure-password',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(sessionsService.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const code = '123456';
    const codeHash = createHmac('sha256', 'verification-secret')
      .update(`user@example.com:${code}`)
      .digest('hex');

    it('verifies a valid code and issues a session', async () => {
      const pendingUser = {
        ...user,
        emailVerifiedAt: null,
        emailVerificationCodeHash: codeHash,
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        emailVerificationSentAt: new Date(),
      };
      userRepository.findUnique.mockResolvedValue(pendingUser);
      userRepository.update.mockResolvedValue(publicUser);
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.verifyEmail({ email: user.email, code });

      expect(result.user).toEqual(publicUser);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe(issuedRefreshToken);
      expect(sessionsService.create).toHaveBeenCalledWith(user.id, undefined);
      const verificationUpdate = userRepository.update.mock.calls[0][0] as {
        where: { id: string };
        data: {
          emailVerifiedAt: Date;
          emailVerificationCodeHash: null;
          emailVerificationAttempts: number;
        };
      };
      expect(verificationUpdate.where).toEqual({ id: user.id });
      expect(verificationUpdate.data.emailVerifiedAt).toBeInstanceOf(Date);
      expect(verificationUpdate.data.emailVerificationCodeHash).toBeNull();
      expect(verificationUpdate.data.emailVerificationAttempts).toBe(0);
    });

    it('counts an invalid verification attempt without issuing tokens', async () => {
      userRepository.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: null,
        emailVerificationCodeHash: codeHash,
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      });
      userRepository.update.mockResolvedValue(user);

      await expect(
        service.verifyEmail({ email: user.email, code: '654321' }),
      ).rejects.toThrow(BadRequestException);

      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { emailVerificationAttempts: { increment: 1 } },
      });
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(sessionsService.create).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('does not reveal whether an unknown account exists', async () => {
      userRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.resendVerification('missing@example.com'),
      ).resolves.toEqual({ success: true });

      expect(userRepository.update).not.toHaveBeenCalled();
      expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('enforces a cooldown between verification emails', async () => {
      userRepository.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: null,
        emailVerificationSentAt: new Date(),
      });

      await expect(
        service.resendVerification(user.email),
      ).rejects.toMatchObject({ status: 429 });

      expect(userRepository.update).not.toHaveBeenCalled();
      expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('does not reveal whether an account exists', async () => {
      userRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword('MISSING@EXAMPLE.COM'),
      ).resolves.toEqual({ success: true });

      expect(userRepository.update).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetCode).not.toHaveBeenCalled();
    });

    it('stores a hashed code and sends it to a verified account', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
      userRepository.findUnique.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(user);
      emailService.sendPasswordResetCode.mockResolvedValue(undefined);

      await expect(service.forgotPassword(user.email)).resolves.toEqual({
        success: true,
      });

      const emailInput = emailService.sendPasswordResetCode.mock.calls[0][0];
      expect(emailInput).toEqual(
        expect.objectContaining({
          email: user.email,
          fullName: user.fullName,
        }),
      );
      expect(emailInput.code).toMatch(/^\d{6}$/);
      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          passwordResetCodeHash: createHmac('sha256', 'verification-secret')
            .update(`password-reset:${user.email}:${emailInput.code}`)
            .digest('hex'),
          passwordResetExpiresAt: new Date('2026-09-23T12:10:00.000Z'),
          passwordResetSentAt: new Date('2026-09-23T12:00:00.000Z'),
          passwordResetAttempts: 0,
        },
      });
    });

    it('silently respects the resend cooldown', async () => {
      userRepository.findUnique.mockResolvedValue({
        ...user,
        passwordResetSentAt: new Date(),
      });

      await expect(service.forgotPassword(user.email)).resolves.toEqual({
        success: true,
      });

      expect(userRepository.update).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetCode).not.toHaveBeenCalled();
    });

    it('clears its code without exposing an email delivery failure', async () => {
      userRepository.findUnique.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(user);
      userRepository.updateMany.mockResolvedValue({ count: 1 });
      emailService.sendPasswordResetCode.mockRejectedValue(
        new Error('provider unavailable'),
      );

      await expect(service.forgotPassword(user.email)).resolves.toEqual({
        success: true,
      });

      expect(userRepository.updateMany).toHaveBeenCalledWith({
        where: {
          id: user.id,
          passwordResetCodeHash: expect.any(String) as unknown,
        },
        data: {
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
          passwordResetAttempts: 0,
        },
      });
    });
  });

  describe('resetPassword', () => {
    const code = '123456';
    const codeHash = createHmac('sha256', 'verification-secret')
      .update(`password-reset:${user.email}:${code}`)
      .digest('hex');
    const resetUser = {
      ...user,
      passwordResetCodeHash: codeHash,
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
      passwordResetSentAt: new Date(),
      passwordResetAttempts: 0,
    };

    it('atomically replaces the password and revokes existing sessions', async () => {
      userRepository.findUnique.mockResolvedValue(resetUser);
      hashMock.mockResolvedValue('new-password-hash');
      userRepository.updateMany.mockResolvedValue({ count: 1 });
      sessionsService.revokeAllForUser.mockResolvedValue(undefined);

      await expect(
        service.resetPassword({
          email: 'USER@EXAMPLE.COM',
          code,
          password: 'new-secure-password',
        }),
      ).resolves.toEqual({ success: true });

      expect(bcrypt.hash).toHaveBeenCalledWith('new-secure-password', 12);
      expect(userRepository.updateMany).toHaveBeenCalledWith({
        where: { id: user.id, passwordResetCodeHash: codeHash },
        data: {
          passwordHash: 'new-password-hash',
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
          passwordResetAttempts: 0,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Revoking inside the same transaction means a failure cannot leave the
      // new password in place with old sessions still signed in.
      expect(sessionsService.revokeAllForUser).toHaveBeenCalledWith(
        user.id,
        SessionRevocationReason.PASSWORD_RESET,
        prisma,
      );
    });

    it('rejects a code that a concurrent reset already used', async () => {
      userRepository.findUnique.mockResolvedValue(resetUser);
      hashMock.mockResolvedValue('new-password-hash');
      userRepository.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resetPassword({
          email: user.email,
          code,
          password: 'new-secure-password',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(sessionsService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('counts an invalid code without hashing a new password', async () => {
      userRepository.findUnique.mockResolvedValue(resetUser);
      userRepository.update.mockResolvedValue(user);

      await expect(
        service.resetPassword({
          email: user.email,
          code: '654321',
          password: 'new-secure-password',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { passwordResetAttempts: { increment: 1 } },
      });
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userRepository.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an expired code', async () => {
      userRepository.findUnique.mockResolvedValue({
        ...resetUser,
        passwordResetExpiresAt: new Date(Date.now() - 1),
      });

      await expect(
        service.resetPassword({
          email: user.email,
          code,
          password: 'new-secure-password',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(userRepository.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const grant: SessionGrant = {
      sessionId: 'session-1',
      user: publicUser,
      refreshToken: issuedRefreshToken,
    };

    it('signs a new access token for the rotated session', async () => {
      sessionsService.rotate.mockResolvedValue(grant);
      jwtService.signAsync.mockResolvedValue('new-access-token');

      await expect(service.refresh('current-refresh-token')).resolves.toEqual({
        user: publicUser,
        accessToken: 'new-access-token',
        refreshToken: issuedRefreshToken,
      });

      expect(sessionsService.rotate).toHaveBeenCalledWith(
        'current-refresh-token',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        sid: 'session-1',
        email: user.email,
        role: user.role,
      });
    });

    it('keeps the current refresh token when a concurrent request rotated it', async () => {
      sessionsService.rotate.mockResolvedValue({
        ...grant,
        refreshToken: null,
      });
      jwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refresh('current-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeNull();
    });

    it('rejects a token that cannot be used', async () => {
      sessionsService.rotate.mockResolvedValue(null);

      await expect(service.refresh('invalid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  it('revokes the session that owns the refresh token on logout', async () => {
    sessionsService.revokeByRefreshToken.mockResolvedValue(undefined);

    await service.logout('current-refresh-token');

    expect(sessionsService.revokeByRefreshToken).toHaveBeenCalledWith(
      'current-refresh-token',
    );
  });

  describe('getMe', () => {
    it('returns the public user profile', async () => {
      userRepository.findUnique.mockResolvedValue(publicUser);

      await expect(service.getMe(user.id)).resolves.toEqual(publicUser);
      expect(userRepository.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
      });
    });

    it('rejects a session whose user no longer exists', async () => {
      userRepository.findUnique.mockResolvedValue(null);

      await expect(service.getMe('missing-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
