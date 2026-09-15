import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { UserRole } from './dto/register.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const userRepository = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };

  const service = new AuthService(
    { user: userRepository } as unknown as PrismaService,
    jwtService as unknown as JwtService,
  );

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
    role: UserRole.BOTH,
    passwordHash: 'stored-password-hash',
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
    updatedAt: new Date('2026-09-15T12:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('normalizes the email, hashes the password, and issues both tokens', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
      userRepository.findUnique.mockResolvedValue(null);
      jest.mocked(bcrypt.hash).mockResolvedValue('new-password-hash');
      userRepository.create.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.register({
        email: 'USER@EXAMPLE.COM',
        password: 'secure-password',
        fullName: 'Test User',
        role: UserRole.BOTH,
      });

      expect(userRepository.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        select: { id: true },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('secure-password', 12);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            email: 'user@example.com',
            passwordHash: 'new-password-hash',
            fullName: 'Test User',
            role: UserRole.BOTH,
          },
        }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      expect(result.user).toBe(user);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);

      const refreshToken = result.refreshToken;
      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          refreshTokenHash: createHash('sha256')
            .update(refreshToken)
            .digest('hex'),
          refreshTokenExpiresAt: new Date('2026-09-22T12:00:00.000Z'),
        },
      });
      jest.useRealTimers();
    });

    it('rejects an email that is already registered', async () => {
      userRepository.findUnique.mockResolvedValue({ id: user.id });

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
