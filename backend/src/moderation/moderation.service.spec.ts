import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from '../auth/sessions.service.js';
import { ListingsService } from '../listings/listings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ModerationService } from './moderation.service.js';

describe('ModerationService', () => {
  const prisma = {
    listing: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    report: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((run: (tx: unknown) => unknown) => run(prisma)),
  };
  const listings = { remove: vi.fn() };
  const sessions = { revokeAllForUser: vi.fn() };

  const service = new ModerationService(
    prisma as unknown as PrismaService,
    listings as unknown as ListingsService,
    sessions as unknown as SessionsService,
  );

  const reportRow = {
    id: 'report-1',
    reason: 'SCAM',
    details: null,
    status: 'RESOLVED',
    listingTitle: 'Košenje',
    handledAt: new Date('2026-11-06T12:00:00Z'),
    createdAt: new Date('2026-11-06T11:00:00Z'),
    reporter: { id: 'user-2', fullName: 'Kenan' },
    reportedUser: { id: 'user-1', fullName: 'Amra', suspendedAt: null },
    listing: null,
    handledBy: { id: 'admin-1', fullName: 'Admin' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('report', () => {
    it('reports a job against its client, with the title kept', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'user-1',
        title: 'Košenje',
      });
      prisma.report.findFirst.mockResolvedValue(null);

      await service.report(
        { listingId: 'listing-1', reason: 'SCAM', details: '' },
        'user-2',
      );

      expect(prisma.report.create).toHaveBeenCalledWith({
        data: {
          reportedUserId: 'user-1',
          listingId: 'listing-1',
          listingTitle: 'Košenje',
          reporterId: 'user-2',
          reason: 'SCAM',
          details: null,
        },
      });
    });

    it('needs exactly one target', async () => {
      await expect(
        service.report({ reason: 'SPAM' }, 'user-2'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.report(
          { listingId: 'listing-1', userId: 'user-1', reason: 'SPAM' },
          'user-2',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a report about the user themselves', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });

      await expect(
        service.report({ userId: 'user-2', reason: 'SPAM' }, 'user-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a second open report about the same target', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.report.findFirst.mockResolvedValue({ id: 'report-1' });

      await expect(
        service.report({ userId: 'user-1', reason: 'SPAM' }, 'user-2'),
      ).rejects.toMatchObject({ response: { code: 'ALREADY_REPORTED' } });
      expect(prisma.report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reporterId: 'user-2',
            reportedUserId: 'user-1',
            listingId: null,
            status: 'OPEN',
          },
        }),
      );
      expect(prisma.report.create).not.toHaveBeenCalled();
    });
  });

  describe('handle', () => {
    it('closes an open report and keeps the deleted job title', async () => {
      prisma.report.updateMany.mockResolvedValue({ count: 1 });
      prisma.report.findUnique.mockResolvedValue(reportRow);

      await expect(
        service.handle('report-1', 'RESOLVED', 'admin-1'),
      ).resolves.toMatchObject({
        status: 'RESOLVED',
        reportedUser: { id: 'user-1', suspended: false },
        listing: { id: null, title: 'Košenje', status: null },
      });
      expect(prisma.report.updateMany).toHaveBeenCalledWith({
        where: { id: 'report-1', status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          handledById: 'admin-1',
          handledAt: expect.any(Date) as Date,
        },
      });
    });

    it('tells a handled report from a missing one', async () => {
      prisma.report.updateMany.mockResolvedValue({ count: 0 });
      prisma.report.findUnique.mockResolvedValueOnce(reportRow);
      await expect(
        service.handle('report-1', 'DISMISSED', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);

      prisma.report.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.handle('missing', 'DISMISSED', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('suspend', () => {
    it('ends the sessions, closes the jobs and resolves the reports', async () => {
      prisma.user.findUnique.mockResolvedValue({
        isAdmin: false,
        suspendedAt: null,
      });

      await service.suspend('user-1', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { suspendedAt: expect.any(Date) as Date },
      });
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
        'SUSPENDED',
        prisma,
      );
      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: { clientId: 'user-1', status: 'OPEN' },
        data: { status: 'CLOSED', expiresAt: null, expiryReminderSentAt: null },
      });
      expect(prisma.report.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reportedUserId: 'user-1', status: 'OPEN' },
        }),
      );
    });

    it('never suspends an admin or the admin themselves', async () => {
      await expect(
        service.suspend('admin-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.user.findUnique.mockResolvedValue({
        isAdmin: true,
        suspendedAt: null,
      });
      await expect(
        service.suspend('admin-2', 'admin-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  it('resolves the reports about a job before deleting it', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: 'listing-1' });

    await service.deleteListing('listing-1', 'admin-1');

    expect(prisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listingId: 'listing-1', status: 'OPEN' },
      }),
    );
    expect(listings.remove).toHaveBeenCalledWith('listing-1');
  });
});
