import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AdminService } from './admin.service.js';

describe('AdminService', () => {
  const prisma = {
    user: { findMany: vi.fn(), count: vi.fn() },
    listing: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    application: { count: vi.fn() },
    report: { count: vi.fn() },
  };
  const storage = { url: vi.fn((key: string) => `https://photos/${key}`) };
  const service = new AdminService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('searches the name and email of suspended users only', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          fullName: 'Amra',
          email: 'amra@example.com',
          role: 'BOTH',
          avatarId: 'avatar-1',
          isAdmin: false,
          suspendedAt: new Date('2026-11-06T12:00:00Z'),
          emailVerifiedAt: null,
          createdAt: new Date('2026-11-01T12:00:00Z'),
          _count: { listings: 2, applications: 1, reportsReceived: 3 },
        },
      ]);
      prisma.user.count.mockResolvedValue(21);

      const page = await service.getUsers({
        q: 'amra',
        filter: 'SUSPENDED',
        page: 2,
        limit: 20,
      });

      const where = {
        suspendedAt: { not: null },
        OR: [
          { fullName: { contains: 'amra', mode: 'insensitive' } },
          { email: { contains: 'amra', mode: 'insensitive' } },
        ],
      };
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 20, take: 20 }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith({ where });
      expect(page).toMatchObject({ total: 21, page: 2, totalPages: 2 });
      expect(page.items[0]).toMatchObject({
        avatarUrl: 'https://photos/avatars/user-1/avatar-1.webp',
        emailVerified: false,
        listings: 2,
        applications: 1,
        openReports: 3,
      });
    });

    it('lists only admins', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({ filter: 'ADMINS' });

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { isAdmin: true },
      });
    });
  });

  describe('setListingStatus', () => {
    it('closes a job', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        client: { suspendedAt: null },
      });

      await service.setListingStatus('listing-1', 'CLOSED');

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: { status: 'CLOSED', expiresAt: null, expiryReminderSentAt: null },
      });
    });

    it('keeps the job of a suspended client closed', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        client: { suspendedAt: new Date() },
      });

      const error = await service
        .setListingStatus('listing-1', 'OPEN')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'CLIENT_SUSPENDED',
      });
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('rejects a missing job', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.setListingStatus('missing', 'CLOSED'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
