import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobAlertsService, type PostedListing } from './job-alerts.service.js';

describe('JobAlertsService', () => {
  const alertRepository = {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  };
  const notifications = { notifyMany: vi.fn() };
  const email = { sendNewListingMatch: vi.fn() };

  const service = new JobAlertsService(
    { jobAlert: alertRepository } as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    email as unknown as EmailService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    email.sendNewListingMatch.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('saves an alert, with null for the field left out', async () => {
      alertRepository.findMany.mockResolvedValue([]);
      alertRepository.create.mockResolvedValue({ id: 'alert-1' });

      await expect(
        service.create('user-1', { category: 'MOVING' }),
      ).resolves.toEqual({ id: 'alert-1' });
      expect(alertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'user-1', category: 'MOVING', location: null },
        }),
      );
    });

    it('needs a category or a location', async () => {
      await expect(service.create('user-1', {})).rejects.toMatchObject({
        status: 400,
        response: { code: 'JOB_ALERT_EMPTY' },
      });
      expect(alertRepository.create).not.toHaveBeenCalled();
    });

    it('refuses the same alert twice', async () => {
      alertRepository.findMany.mockResolvedValue([
        { category: 'MOVING', location: null },
      ]);

      await expect(
        service.create('user-1', { category: 'MOVING' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'JOB_ALERT_EXISTS' },
      });
    });

    it('allows at most 10 alerts', async () => {
      alertRepository.findMany.mockResolvedValue(
        Array.from({ length: 10 }, () => ({
          category: 'MOVING',
          location: 'TUZLA',
        })),
      );

      await expect(
        service.create('user-1', { location: 'SARAJEVO' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'TOO_MANY_JOB_ALERTS' },
      });
    });
  });

  describe('remove', () => {
    it("deletes only the user's own alert", async () => {
      alertRepository.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove('alert-1', 'user-1');

      expect(alertRepository.deleteMany).toHaveBeenCalledWith({
        where: { id: 'alert-1', userId: 'user-1' },
      });
    });

    it('returns 404 for an unknown alert', async () => {
      alertRepository.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('alert-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listingPosted', () => {
    const listing: PostedListing = {
      id: 'listing-1',
      title: 'Selidba',
      category: 'MOVING',
      location: 'TUZLA',
      budget: 80,
      client: { id: 'client-1', fullName: 'Amra' },
    };

    function user(id: string, emailNotifications = true) {
      return {
        user: {
          id,
          email: `${id}@example.com`,
          fullName: id,
          emailNotifications,
        },
      };
    }

    it('notifies the matching users and emails those who want email', async () => {
      alertRepository.findMany.mockResolvedValue([
        user('kenan'),
        user('lejla', false),
      ]);

      await service.listingPosted(listing);

      expect(alertRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ category: 'MOVING' }, { category: null }] },
              { OR: [{ location: 'TUZLA' }, { location: null }] },
            ],
            userId: { not: 'client-1' },
            user: { suspendedAt: null, emailVerifiedAt: { not: null } },
          },
          distinct: ['userId'],
        }),
      );
      expect(notifications.notifyMany).toHaveBeenCalledWith(
        ['kenan', 'lejla'],
        {
          type: 'NEW_LISTING_MATCH',
          listingId: 'listing-1',
          listingTitle: 'Selidba',
          actorName: 'Amra',
        },
      );
      expect(email.sendNewListingMatch).toHaveBeenCalledTimes(1);
      expect(email.sendNewListingMatch).toHaveBeenCalledWith({
        email: 'kenan@example.com',
        fullName: 'kenan',
        listingId: 'listing-1',
        listingTitle: 'Selidba',
        budget: 80,
      });
    });

    it('does nothing without matching alerts', async () => {
      alertRepository.findMany.mockResolvedValue([]);

      await service.listingPosted(listing);

      expect(notifications.notifyMany).not.toHaveBeenCalled();
      expect(email.sendNewListingMatch).not.toHaveBeenCalled();
    });

    it('never fails the posting', async () => {
      alertRepository.findMany.mockRejectedValue(new Error('db down'));

      await expect(service.listingPosted(listing)).resolves.toBeUndefined();
    });

    it('logs a failed email without failing', async () => {
      alertRepository.findMany.mockResolvedValue([user('kenan')]);
      email.sendNewListingMatch.mockRejectedValue(new Error('provider down'));

      await expect(service.listingPosted(listing)).resolves.toBeUndefined();
    });
  });
});
