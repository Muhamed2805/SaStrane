import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '../generated/prisma/enums.js';
import { LiveService } from '../live/live.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  listingId: true,
  listingTitle: true,
  actorName: true,
  readAt: true,
  createdAt: true,
} as const;

export type NewNotification = {
  userId: string;
  type: NotificationType;
  listingId: string;
  listingTitle: string;
  actorName: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
  ) {}

  // Called after the event is saved. A failure is logged and does not fail
  // the request that caused it.
  async notify(notification: NewNotification) {
    try {
      await this.prisma.notification.create({ data: notification });
      this.live.emit(notification.userId, { type: 'notification' });
    } catch (error) {
      this.logger.error(
        `${notification.type} notification for ${notification.userId} failed: ${(error as Error).message}`,
      );
    }
  }

  // The same notice for several users, as one insert. Never throws, like
  // notify.
  async notifyMany(
    userIds: string[],
    notification: Omit<NewNotification, 'userId'>,
  ) {
    if (userIds.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ ...notification, userId })),
      });
      for (const userId of userIds) {
        this.live.emit(userId, { type: 'notification' });
      }
    } catch (error) {
      this.logger.error(
        `${notification.type} notifications for ${userIds.length} users failed: ${(error as Error).message}`,
      );
    }
  }

  // Newest first.
  async getAll(userId: string, query: NotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { userId };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: NOTIFICATION_SELECT,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  // Marking a read notification again changes nothing.
  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { readAt: true },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.readAt) return;
    await this.prisma.notification.updateMany({
      where: { id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
