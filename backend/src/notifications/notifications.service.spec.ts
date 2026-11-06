import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  const notificationRepository = {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };

  const service = new NotificationsService({
    notification: notificationRepository,
  } as unknown as PrismaService);

  const notification = {
    userId: 'user-1',
    type: 'INVITATION' as const,
    listingId: 'listing-1',
    listingTitle: 'Selidba',
    actorName: 'Amra',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('notify', () => {
    it('saves the notification', async () => {
      notificationRepository.create.mockResolvedValue({ id: 'n-1' });

      await service.notify(notification);

      expect(notificationRepository.create).toHaveBeenCalledWith({
        data: notification,
      });
    });

    it('does not fail the request when saving fails', async () => {
      notificationRepository.create.mockRejectedValue(new Error('db down'));

      await expect(service.notify(notification)).resolves.toBeUndefined();
    });
  });

  describe('getAll', () => {
    it("pages the user's notifications, newest first", async () => {
      notificationRepository.findMany.mockResolvedValue([{ id: 'n-1' }]);
      notificationRepository.count.mockResolvedValue(21);

      await expect(
        service.getAll('user-1', { page: 2, limit: 20 }),
      ).resolves.toEqual({
        items: [{ id: 'n-1' }],
        total: 21,
        page: 2,
        limit: 20,
        totalPages: 2,
      });
      expect(notificationRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: 20,
          take: 20,
        }),
      );
    });
  });

  it('counts the unread notifications', async () => {
    notificationRepository.count.mockResolvedValue(3);

    await expect(service.getUnreadCount('user-1')).resolves.toEqual({
      count: 3,
    });
    expect(notificationRepository.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
    });
  });

  describe('markRead', () => {
    it('marks an unread notification as read', async () => {
      notificationRepository.findFirst.mockResolvedValue({ readAt: null });

      await service.markRead('n-1', 'user-1');

      expect(notificationRepository.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'n-1', userId: 'user-1' } }),
      );
      expect(notificationRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'n-1', readAt: null },
        data: { readAt: expect.any(Date) as unknown },
      });
    });

    it('leaves a read notification as it is', async () => {
      notificationRepository.findFirst.mockResolvedValue({
        readAt: new Date(),
      });

      await service.markRead('n-1', 'user-1');

      expect(notificationRepository.updateMany).not.toHaveBeenCalled();
    });

    it("returns 404 for another user's notification", async () => {
      notificationRepository.findFirst.mockResolvedValue(null);

      await expect(service.markRead('n-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it("marks all of the user's unread notifications as read", async () => {
    await service.markAllRead('user-1');

    expect(notificationRepository.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) as unknown },
    });
  });
});
