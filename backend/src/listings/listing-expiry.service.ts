import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { ListingStatus, NotificationType } from '../generated/prisma/enums.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { daysFrom, EXPIRY_REMINDER_DAYS } from './listing-expiry.js';

const CHECK_INTERVAL_MS = 60 * 60_000;
const BATCH_SIZE = 100;

const EXPIRY_SELECT = {
  id: true,
  title: true,
  expiresAt: true,
  client: {
    select: { id: true, email: true, fullName: true, emailNotifications: true },
  },
} satisfies Prisma.ListingSelect;

type ExpiryRow = Prisma.ListingGetPayload<{ select: typeof EXPIRY_SELECT }>;

// Once an hour: tells clients that an open job expires within 3 days, and
// closes the open jobs whose time ran out. Each job is claimed with a
// conditional update first, so two API instances never tell a client twice.
@Injectable()
export class ListingExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ListingExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // The tests call runDue themselves.
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => void this.runDue(), CHECK_INTERVAL_MS);
    this.timer.unref();
    void this.runDue();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Returns how many clients were reminded and how many jobs expired.
  async runDue(now = new Date()) {
    // A slow check must not overlap the next one.
    if (this.running) return { reminded: 0, expired: 0 };
    this.running = true;
    try {
      const expired = await this.expireDue(now);
      const reminded = await this.remindDue(now);
      return { reminded, expired };
    } catch (error) {
      this.logger.error(
        `Checking for expiring jobs failed: ${(error as Error).message}`,
      );
      return { reminded: 0, expired: 0 };
    } finally {
      this.running = false;
    }
  }

  private async remindDue(now: Date) {
    const where = {
      status: ListingStatus.OPEN,
      expiresAt: { gt: now, lte: daysFrom(now, EXPIRY_REMINDER_DAYS) },
      expiryReminderSentAt: null,
    } satisfies Prisma.ListingWhereInput;

    return this.claimAll(
      where,
      (id) =>
        this.prisma.listing.updateMany({
          where: { ...where, id },
          data: { expiryReminderSentAt: now },
        }),
      (listing) => this.tell(listing, NotificationType.LISTING_EXPIRING),
    );
  }

  private async expireDue(now: Date) {
    const where = {
      status: ListingStatus.OPEN,
      expiresAt: { lte: now },
    } satisfies Prisma.ListingWhereInput;

    // The expiry time stays, so the job shows as expired, not closed.
    return this.claimAll(
      where,
      (id) =>
        this.prisma.listing.updateMany({
          where: { ...where, id },
          data: { status: ListingStatus.CLOSED },
        }),
      (listing) => this.tell(listing, NotificationType.LISTING_EXPIRED),
    );
  }

  private async claimAll(
    where: Prisma.ListingWhereInput,
    claim: (id: string) => Promise<{ count: number }>,
    after: (listing: ExpiryRow) => Promise<void>,
  ) {
    let done = 0;
    for (;;) {
      const due = await this.prisma.listing.findMany({
        where,
        orderBy: { expiresAt: 'asc' },
        take: BATCH_SIZE,
        select: EXPIRY_SELECT,
      });
      for (const listing of due) {
        // Another instance may have claimed it in the meantime.
        const { count } = await claim(listing.id);
        if (count === 0) continue;
        done += 1;
        await after(listing);
      }
      if (due.length < BATCH_SIZE) return done;
    }
  }

  private async tell(
    listing: ExpiryRow,
    type: 'LISTING_EXPIRING' | 'LISTING_EXPIRED',
  ) {
    const { client } = listing;
    await this.notifications.notify({
      userId: client.id,
      type,
      listingId: listing.id,
      listingTitle: listing.title,
      // The site does it, not another user.
      actorName: '',
    });
    if (!client.emailNotifications || !listing.expiresAt) return;
    await this.email
      .sendListingExpiry({
        email: client.email,
        fullName: client.fullName,
        listingId: listing.id,
        listingTitle: listing.title,
        expiresAt: listing.expiresAt,
        expired: type === NotificationType.LISTING_EXPIRED,
      })
      .catch((error: Error) =>
        this.logger.error(
          `Expiry email for listing ${listing.id} failed: ${error.message}`,
        ),
      );
  }
}
