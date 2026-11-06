import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListingExpiryService } from './listing-expiry.service.js';

describe('ListingExpiryService', () => {
  const listingRepository = { findMany: vi.fn(), updateMany: vi.fn() };
  const notifications = { notify: vi.fn() };
  const email = { sendListingExpiry: vi.fn() };

  const service = new ListingExpiryService(
    { listing: listingRepository } as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    email as unknown as EmailService,
    { get: () => 'test' } as unknown as ConfigService,
  );

  const now = new Date('2026-12-01T10:00:00.000Z');
  const inTwoDays = new Date('2026-12-03T10:00:00.000Z');

  function listing(id: string, expiresAt: Date, emailNotifications = true) {
    return {
      id,
      title: `Oglas ${id}`,
      expiresAt,
      client: {
        id: `client-${id}`,
        email: `${id}@example.com`,
        fullName: 'Amra',
        emailNotifications,
      },
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    email.sendListingExpiry.mockResolvedValue(undefined);
    listingRepository.updateMany.mockResolvedValue({ count: 1 });
  });

  it('closes the jobs whose time ran out and tells their clients', async () => {
    listingRepository.findMany
      .mockResolvedValueOnce([listing('old', now)])
      .mockResolvedValueOnce([]);

    await expect(service.runDue(now)).resolves.toEqual({
      reminded: 0,
      expired: 1,
    });

    expect(listingRepository.findMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'OPEN', expiresAt: { lte: now } },
    });
    expect(listingRepository.updateMany).toHaveBeenCalledWith({
      where: { status: 'OPEN', expiresAt: { lte: now }, id: 'old' },
      data: { status: 'CLOSED' },
    });
    expect(notifications.notify).toHaveBeenCalledWith({
      userId: 'client-old',
      type: 'LISTING_EXPIRED',
      listingId: 'old',
      listingTitle: 'Oglas old',
      actorName: '',
    });
    expect(email.sendListingExpiry).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'old@example.com', expired: true }),
    );
  });

  it('reminds clients 3 days ahead, once', async () => {
    listingRepository.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        listing('soon', inTwoDays),
        listing('quiet', inTwoDays, false),
      ]);

    await expect(service.runDue(now)).resolves.toEqual({
      reminded: 2,
      expired: 0,
    });

    expect(listingRepository.findMany.mock.calls[1][0]).toMatchObject({
      where: {
        status: 'OPEN',
        expiresAt: { gt: now, lte: new Date('2026-12-04T10:00:00.000Z') },
        expiryReminderSentAt: null,
      },
    });
    expect(listingRepository.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'soon',
          expiryReminderSentAt: null,
        }) as unknown,
        data: { expiryReminderSentAt: now },
      }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LISTING_EXPIRING', listingId: 'soon' }),
    );
    // Only the client who wants emails gets one.
    expect(email.sendListingExpiry).toHaveBeenCalledTimes(1);
    expect(email.sendListingExpiry).toHaveBeenCalledWith({
      email: 'soon@example.com',
      fullName: 'Amra',
      listingId: 'soon',
      listingTitle: 'Oglas soon',
      expiresAt: inTwoDays,
      expired: false,
    });
  });

  it('skips a job another instance claimed first', async () => {
    listingRepository.findMany
      .mockResolvedValueOnce([listing('old', now)])
      .mockResolvedValueOnce([]);
    listingRepository.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.runDue(now)).resolves.toEqual({
      reminded: 0,
      expired: 0,
    });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('logs failures without throwing', async () => {
    listingRepository.findMany
      .mockResolvedValueOnce([listing('old', now)])
      .mockResolvedValueOnce([]);
    email.sendListingExpiry.mockRejectedValue(new Error('provider down'));

    await expect(service.runDue(now)).resolves.toEqual({
      reminded: 0,
      expired: 1,
    });

    listingRepository.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.runDue(now)).resolves.toEqual({
      reminded: 0,
      expired: 0,
    });
  });
});
