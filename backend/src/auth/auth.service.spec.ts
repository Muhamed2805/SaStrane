import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { UserRole } from './dto/register.dto';
import { EmailService } from './email.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const userRepository = {
    create: jest.fn<(input: unknown) => Promise<unknown>>(),
    delete: jest.fn<(input: unknown) => Promise<unknown>>(),
    findUnique: jest.fn<(input: unknown) => Promise<unknown>>(),
    update: jest.fn<(input: unknown) => Promise<unknown>>(),
    updateMany: jest.fn<(input: unknown) => Promise<{ count: number }>>(),
  };
  const jwtService = {
    signAsync: jest.fn<(payload: unknown) => Promise<string>>(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EMAIL_VERIFICATION_SECRET') return 'verification-secret';
      if (key === 'JWT_SECRET') return 'jwt-secret';
      return undefined;
    }),
  };
  const emailService = {
    sendVerificationCode:
      jest.fn<
        (input: {
          email: string;
          fullName: string;
          code: string;
        }) => Promise<void>
      >(),
    sendPasswordResetCode:
      jest.fn<
        (input: {
          email: string;
          fullName: string;
          code: string;
        }) => Promise<void>
      >(),
  };

  const service = new AuthService(
    { user: userRepository } as unknown as PrismaService,
    jwtService as unknown as JwtService,
    configService as unknown as ConfigService,
    emailService as unknown as EmailService,
  );

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
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
    updatedAt: new Date('2026-09-15T12:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_VERIFICATION_SECRET') return 'verification-secret';
      if (key === 'JWT_SECRET') return 'jwt-secret';
      return undefined;
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
      jest.mocked(bcrypt.hash).mockResolvedValue('new-password-hash');
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
      // Jest exposes mock call arguments as `any`; narrow them immediately.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
      jest.mocked(bcrypt.hash).mockResolvedValue('new-password-hash');
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
    it('returns a safe user response and rotates the refresh token', async () => {
      userRepository.findUnique.mockResolvedValue(user);
      jest.mocked(bcrypt.compare).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('access-token');
      userRepository.update.mockResolvedValue(user);

      const result = await service.login({
        email: 'USER@EXAMPLE.COM',
        password: 'secure-password',
      });

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
      expect(userRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: user.id } }),
      );
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
      jest.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(
        service.login({
          email: user.email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a valid password until the email is verified', async () => {
      userRepository.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: null,
      });
      jest.mocked(bcrypt.compare).mockResolvedValue(true);

      await expect(
        service.login({
          email: user.email,
          password: 'secure-password',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
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
      const verifiedUser = { ...pendingUser, emailVerifiedAt: new Date() };
      userRepository.findUnique.mockResolvedValue(pendingUser);
      userRepository.update
        .mockResolvedValueOnce(verifiedUser)
        .mockResolvedValueOnce(verifiedUser);
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.verifyEmail({ email: user.email, code });

      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

      // Jest exposes mock call arguments as `any`; narrow them immediately.
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      const emailInput = emailService.sendPasswordResetCode.mock
        .calls[0][0] as {
        email: string;
        fullName: string;
        code: string;
      };
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
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
      jest.mocked(bcrypt.hash).mockResolvedValue('new-password-hash');
      userRepository.updateMany.mockResolvedValue({ count: 1 });

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
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
      });
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
    it('accepts a valid token and replaces it with a new refresh token', async () => {
      const rawRefreshToken = 'valid-refresh-token';
      userRepository.findUnique.mockResolvedValue({
        ...user,
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      jwtService.signAsync.mockResolvedValue('new-access-token');
      userRepository.update.mockResolvedValue(user);

      const result = await service.refresh(rawRefreshToken);

      expect(userRepository.findUnique).toHaveBeenCalledWith({
        where: {
          refreshTokenHash: createHash('sha256')
            .update(rawRefreshToken)
            .digest('hex'),
        },
      });
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).not.toBe(rawRefreshToken);
      expect(userRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: user.id } }),
      );
    });

    it.each([
      ['unknown', null],
      ['missing expiry', { ...user, refreshTokenExpiresAt: null }],
      [
        'expired',
        { ...user, refreshTokenExpiresAt: new Date(Date.now() - 60_000) },
      ],
    ])('rejects a %s refresh token', async (_case, storedUser) => {
      userRepository.findUnique.mockResolvedValue(storedUser);

      await expect(service.refresh('invalid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  it('revokes the stored refresh token on logout', async () => {
    userRepository.update.mockResolvedValue(user);

    await service.logout(user.id);

    expect(userRepository.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  });

  describe('getMe', () => {
    it('returns the public user profile', async () => {
      const publicUser = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      };
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
