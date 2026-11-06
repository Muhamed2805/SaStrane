import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BadRequestException, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';
import {
  SessionRevocationReason,
  UserRole,
} from '../generated/prisma/enums.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AccountService } from './account.service.js';
import { PUBLIC_USER_SELECT } from './public-user.js';
import { SessionsService } from './sessions.service.js';

// The service imports bcrypt's default export.
vi.mock('bcrypt', () => {
  const mocked = { compare: vi.fn(), hash: vi.fn() };
  return { ...mocked, default: mocked };
});

// bcrypt's functions are overloaded, so type the promise form directly.
const hashMock = bcrypt.hash as unknown as Mock<
  (data: string, rounds: number) => Promise<string>
>;
const compareMock = bcrypt.compare as unknown as Mock<
  (data: string, encrypted: string) => Promise<boolean>
>;

type Call = [input: unknown];

describe('AccountService', () => {
  const stored = {
    email: 'amra@example.com',
    fullName: 'Amra Hodžić',
    passwordHash: 'old-hash',
  };

  const userRepository = {
    findUnique: vi.fn<(...args: Call) => Promise<unknown>>(),
    update: vi.fn<(...args: Call) => Promise<unknown>>(),
    updateMany: vi.fn<(...args: Call) => Promise<{ count: number }>>(),
    delete: vi.fn<(...args: Call) => Promise<unknown>>(),
  };
  const listingPhotoRepository = {
    findMany: vi.fn<(...args: Call) => Promise<unknown>>(),
  };
  type TransactionCallback = (tx: unknown) => Promise<unknown>;
  const prisma = {
    user: userRepository,
    listingPhoto: listingPhotoRepository,
    $transaction: vi.fn<(callback: TransactionCallback) => Promise<unknown>>(),
  };
  const sessions = {
    revokeOthers:
      vi.fn<
        (
          userId: string,
          keepSessionId: string,
          reason: SessionRevocationReason,
          db: unknown,
        ) => Promise<void>
      >(),
  };
  const email = {
    sendPasswordChanged:
      vi.fn<(input: { email: string; fullName: string }) => Promise<void>>(),
  };
  const storage = { delete: vi.fn<(keys: string[]) => Promise<void>>() };

  const service = new AccountService(
    prisma as unknown as PrismaService,
    sessions as unknown as SessionsService,
    email as unknown as EmailService,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    userRepository.findUnique.mockResolvedValue(stored);
    userRepository.updateMany.mockResolvedValue({ count: 1 });
    compareMock.mockResolvedValue(true);
    hashMock.mockResolvedValue('new-hash');
    email.sendPasswordChanged.mockResolvedValue();
    storage.delete.mockResolvedValue();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  describe('updateProfile', () => {
    it('changes only the fields that were sent', async () => {
      userRepository.update.mockResolvedValue({ id: 'user-1' });

      await service.updateProfile('user-1', { role: UserRole.EXECUTOR });

      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          fullName: undefined,
          role: UserRole.EXECUTOR,
          emailNotifications: undefined,
        },
        select: PUBLIC_USER_SELECT,
      });
    });
  });

  describe('changePassword', () => {
    const dto = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    };

    it('saves the new password, ends the other sessions and sends a notice', async () => {
      await service.changePassword('user-1', 'session-1', dto);

      expect(compareMock).toHaveBeenCalledWith('old-password', 'old-hash');
      expect(hashMock).toHaveBeenCalledWith('new-password', 12);
      expect(userRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', passwordHash: 'old-hash' },
        data: {
          passwordHash: 'new-hash',
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
          passwordResetAttempts: 0,
        },
      });
      expect(sessions.revokeOthers).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        SessionRevocationReason.PASSWORD_CHANGE,
        prisma,
      );
      expect(email.sendPasswordChanged).toHaveBeenCalledWith({
        email: stored.email,
        fullName: stored.fullName,
      });
    });

    it('rejects a wrong current password and changes nothing', async () => {
      compareMock.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'session-1', dto),
      ).rejects.toMatchObject({
        response: { code: 'WRONG_PASSWORD' },
      });
      expect(userRepository.updateMany).not.toHaveBeenCalled();
      expect(sessions.revokeOthers).not.toHaveBeenCalled();
    });

    it('fails when another request changed the password meanwhile', async () => {
      userRepository.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.changePassword('user-1', 'session-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(sessions.revokeOthers).not.toHaveBeenCalled();
      expect(email.sendPasswordChanged).not.toHaveBeenCalled();
    });

    it('keeps the change when the notice cannot be sent', async () => {
      email.sendPasswordChanged.mockRejectedValue(new Error('down'));

      await expect(
        service.changePassword('user-1', 'session-1', dto),
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteAccount', () => {
    it('deletes the user and then the photo files of their jobs', async () => {
      listingPhotoRepository.findMany.mockResolvedValue([
        { id: 'photo-1', listingId: 'listing-1' },
        { id: 'photo-2', listingId: 'listing-2' },
      ]);

      await service.deleteAccount('user-1', 'password');

      expect(listingPhotoRepository.findMany).toHaveBeenCalledWith({
        where: { listing: { clientId: 'user-1' } },
        select: { id: true, listingId: true },
      });
      expect(userRepository.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith([
        'listings/listing-1/photo-1.webp',
        'listings/listing-1/photo-1-thumb.webp',
        'listings/listing-2/photo-2.webp',
        'listings/listing-2/photo-2-thumb.webp',
      ]);
    });

    it('rejects a wrong password and deletes nothing', async () => {
      compareMock.mockResolvedValue(false);

      await expect(
        service.deleteAccount('user-1', 'wrong'),
      ).rejects.toMatchObject({ response: { code: 'WRONG_PASSWORD' } });
      expect(userRepository.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
