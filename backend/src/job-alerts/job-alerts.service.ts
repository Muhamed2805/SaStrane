import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingCategory,
  ListingLocation,
  NotificationType,
} from '../generated/prisma/enums.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateJobAlertDto } from './dto/create-job-alert.dto.js';

export const MAX_JOB_ALERTS = 10;

// The fields of JobAlertDto.
const JOB_ALERT_SELECT = {
  id: true,
  category: true,
  location: true,
  createdAt: true,
} as const;

export type PostedListing = {
  id: string;
  title: string;
  category: ListingCategory;
  location: ListingLocation;
  budget: number | null;
  client: { id: string; fullName: string };
};

@Injectable()
export class JobAlertsService {
  private readonly logger = new Logger(JobAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  // Newest first. There are at most MAX_JOB_ALERTS.
  getAll(userId: string) {
    return this.prisma.jobAlert.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: JOB_ALERT_SELECT,
    });
  }

  async create(userId: string, dto: CreateJobAlertDto) {
    const category = dto.category ?? null;
    const location = dto.location ?? null;
    if (!category && !location) {
      throw new BadRequestException({
        code: 'JOB_ALERT_EMPTY',
        message: 'Izaberi vrstu posla, lokaciju ili oboje.',
      });
    }

    const existing = await this.prisma.jobAlert.findMany({
      where: { userId },
      select: { category: true, location: true },
    });
    if (
      existing.some(
        (alert) => alert.category === category && alert.location === location,
      )
    ) {
      throw new ConflictException({
        code: 'JOB_ALERT_EXISTS',
        message: 'Ovo upozorenje već imaš.',
      });
    }
    if (existing.length >= MAX_JOB_ALERTS) {
      throw new ConflictException({
        code: 'TOO_MANY_JOB_ALERTS',
        message: `Možeš imati najviše ${MAX_JOB_ALERTS} upozorenja. Obriši neko u postavkama.`,
      });
    }

    return this.prisma.jobAlert.create({
      data: { userId, category, location },
      select: JOB_ALERT_SELECT,
    });
  }

  async remove(id: string, userId: string) {
    const { count } = await this.prisma.jobAlert.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Job alert not found');
  }

  // Tells the users whose alerts match a new job. An alert without a
  // category or a location matches any. A failure is logged and does not
  // fail the posting.
  async listingPosted(listing: PostedListing) {
    try {
      const alerts = await this.prisma.jobAlert.findMany({
        where: {
          AND: [
            { OR: [{ category: listing.category }, { category: null }] },
            { OR: [{ location: listing.location }, { location: null }] },
          ],
          userId: { not: listing.client.id },
          user: { suspendedAt: null, emailVerifiedAt: { not: null } },
        },
        distinct: ['userId'],
        select: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              emailNotifications: true,
            },
          },
        },
      });
      if (alerts.length === 0) return;

      await this.notifications.notifyMany(
        alerts.map(({ user }) => user.id),
        {
          type: NotificationType.NEW_LISTING_MATCH,
          listingId: listing.id,
          listingTitle: listing.title,
          actorName: listing.client.fullName,
        },
      );

      // Not awaited: the client does not wait for the email provider.
      for (const { user } of alerts) {
        if (!user.emailNotifications) continue;
        this.email
          .sendNewListingMatch({
            email: user.email,
            fullName: user.fullName,
            listingId: listing.id,
            listingTitle: listing.title,
            budget: listing.budget,
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Job alert email for ${user.id} failed: ${(error as Error).message}`,
            );
          });
      }
    } catch (error) {
      this.logger.error(
        `Job alerts for listing ${listing.id} failed: ${(error as Error).message}`,
      );
    }
  }
}
