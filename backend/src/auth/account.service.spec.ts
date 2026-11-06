import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BadRequestException, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import {
  ListingCategory,
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
    avatarId: null as string | null,
  };
  const row = {
    id: 'user-1',
    email: stored.email,
    fullName: stored.fullName,
    role: UserRole.BOTH,
    emailNotifications: true,
    bio: null,
    skills: [],
    avatarId: 'avatar-new',
    createdAt: new Date('2026-11-01T12:00:00Z'),
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
    $queryRaw:
      vi.fn<(...args: unknown[]) => Promise<{ avatarId: string | null }[]>>(),
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
  const storage = {
    put: vi.fn<(key: string, data: Buffer, type: string) => Promise<void>>(),
    delete: vi.fn<(keys: string[]) => Promise<void>>(),
    url: (key: string) => `https://files.test/${key}`,
  };

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
    storage.put.mockResolvedValue();
    storage.delete.mockResolvedValue();
    userRepository.update.mockResolvedValue(row);
    prisma.$queryRaw.mockResolvedValue([{ avatarId: null }]);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  describe('updateProfile', () => {
    it('changes only the fields that were sent', async () => {
      await service.updateProfile('user-1', { role: UserRole.EXECUTOR });

      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          fullName: undefined,
          role: UserRole.EXECUTOR,
          emailNotifications: undefined,
          bio: undefined,
          skills: undefined,
        },
        select: PUBLIC_USER_SELECT,
      });
    });

    it('removes an empty introduction and repeated skills', async () => {
      await service.updateProfile('user-1', {
        bio: '',
        skills: [
          ListingCategory.MOVING,
          ListingCategory.CLEANING,
          ListingCategory.MOVING,
        ],
      });

      expect(userRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bio: null,
            skills: [ListingCategory.MOVING, ListingCategory.CLEANING],
          }) as unknown,
        }),
      );
    });

    it('returns the photo as a URL', async () => {
      const user = await service.updateProfile('user-1', {});

      expect(user.avatarUrl).toBe(
        'https://files.test/avatars/user-1/avatar-new.webp',
      );
      expect(user).not.toHaveProperty('avatarId');
    });
  });

  describe('setAvatar', () => {
    const photo = () =>
      sharp({
        create: { width: 300, height: 200, channels: 3, background: '#fff' },
      })
        .jpeg()
        .toBuffer();

    it('stores a square WebP and deletes the previous photo', async () => {
      prisma.$queryRaw.mockResolvedValue([{ avatarId: 'avatar-old' }]);

      await service.setAvatar('user-1', await photo());

      const [key, data, type] = storage.put.mock.calls[0];
      expect(key).toMatch(/^avatars\/user-1\/[0-9a-f-]{36}\.webp$/);
      expect(type).toBe('image/webp');
      expect(await sharp(data).metadata()).toMatchObject({
        width: 256,
        height: 256,
      });
      expect(userRepository.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarId: key.slice('avatars/user-1/'.length, -5) },
        select: PUBLIC_USER_SELECT,
      });
      expect(storage.delete).toHaveBeenCalledWith([
        'avatars/user-1/avatar-old.webp',
      ]);
    });

    it('deletes the new file when saving fails', async () => {
      userRepository.update.mockRejectedValue(new Error('db down'));

      await expect(service.setAvatar('user-1', await photo())).rejects.toThrow(
        'db down',
      );

      const [key] = storage.put.mock.calls[0];
      expect(storage.delete).toHaveBeenCalledWith([key]);
    });

    it('stores nothing for a file that is not an image', async () => {
      await expect(
        service.setAvatar('user-1', Buffer.from('not an image')),
      ).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
      expect(storage.put).not.toHaveBeenCalled();
    });
  });

  describe('removeAvatar', () => {
    it('clears the photo and deletes its file', async () => {
      prisma.$queryRaw.mockResolvedValue([{ avatarId: 'avatar-old' }]);
      userRepository.update.mockResolvedValue({ ...row, avatarId: null });

      const user = await service.removeAvatar('user-1');

      expect(user.avatarUrl).toBeNull();
      expect(userRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { avatarId: null } }),
      );
      expect(storage.delete).toHaveBeenCalledWith([
        'avatars/user-1/avatar-old.webp',
      ]);
    });

    it('deletes no file when there was no photo', async () => {
      await service.removeAvatar('user-1');

      expect(storage.delete).not.toHaveBeenCalled();
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
      userRepository.findUnique.mockResolvedValue({
        ...stored,
        avatarId: 'avatar-1',
      });
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
        'avatars/user-1/avatar-1.webp',
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
