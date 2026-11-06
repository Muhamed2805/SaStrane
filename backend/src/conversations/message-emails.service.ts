import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// A message that stays unread this long gets an email. Someone who is
// on the site reads it before then and gets none.
export const MESSAGE_EMAIL_DELAY_MS = 10 * 60_000;
const CHECK_INTERVAL_MS = 60_000;
// The rest waits for the next check.
const BATCH_SIZE = 50;

type Side = 'client' | 'executor';

const PARTY = { select: { email: true, fullName: true } };

const DUE_SELECT = {
  id: true,
  clientUnread: true,
  executorUnread: true,
  listing: { select: { title: true } },
  client: PARTY,
  executor: PARTY,
  lastMessage: { select: { body: true } },
} satisfies Prisma.ConversationSelect;

// The Prisma filters for one side of a conversation.
const SIDES: Record<
  Side,
  {
    due: (cutoff: Date) => Prisma.ConversationWhereInput;
    unclaimed: (id: string) => Prisma.ConversationWhereInput;
    emailed: (now: Date) => Prisma.ConversationUpdateManyMutationInput;
  }
> = {
  client: {
    due: (cutoff) => ({
      clientUnread: { gt: 0 },
      clientUnreadSince: { lte: cutoff },
      clientEmailedAt: null,
      client: { emailNotifications: true },
    }),
    unclaimed: (id) => ({ id, clientUnread: { gt: 0 }, clientEmailedAt: null }),
    emailed: (now) => ({ clientEmailedAt: now }),
  },
  executor: {
    due: (cutoff) => ({
      executorUnread: { gt: 0 },
      executorUnreadSince: { lte: cutoff },
      executorEmailedAt: null,
      executor: { emailNotifications: true },
    }),
    unclaimed: (id) => ({
      id,
      executorUnread: { gt: 0 },
      executorEmailedAt: null,
    }),
    emailed: (now) => ({ executorEmailedAt: now }),
  },
};

// Emails a user about messages they have not read for a while: one email
// per conversation until they read it. Checks once a minute.
@Injectable()
export class MessageEmailsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MessageEmailsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // The tests call sendDue themselves.
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => void this.sendDue(), CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Sends the emails that are due and returns how many were sent.
  async sendDue(now = new Date()) {
    // A slow check must not overlap the next one.
    if (this.running) return 0;
    this.running = true;
    try {
      const cutoff = new Date(now.getTime() - MESSAGE_EMAIL_DELAY_MS);
      let sent = 0;
      for (const side of ['client', 'executor'] as const) {
        sent += await this.sendDueFor(side, cutoff, now);
      }
      return sent;
    } catch (error) {
      this.logger.error(
        `Checking for unread messages failed: ${(error as Error).message}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async sendDueFor(side: Side, cutoff: Date, now: Date) {
    const filters = SIDES[side];
    const due = await this.prisma.conversation.findMany({
      where: filters.due(cutoff),
      select: DUE_SELECT,
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    let sent = 0;
    for (const conversation of due) {
      // Marking it first means a second server, or a read in the meantime,
      // cannot lead to a second email. A failed email is not retried.
      const { count } = await this.prisma.conversation.updateMany({
        where: filters.unclaimed(conversation.id),
        data: filters.emailed(now),
      });
      if (count === 0) continue;

      const recipient = conversation[side];
      const sender =
        side === 'client' ? conversation.executor : conversation.client;
      try {
        await this.email.sendUnreadMessages({
          email: recipient.email,
          fullName: recipient.fullName,
          conversationId: conversation.id,
          listingTitle: conversation.listing.title,
          senderName: sender.fullName,
          unreadCount:
            side === 'client'
              ? conversation.clientUnread
              : conversation.executorUnread,
          lastMessage: conversation.lastMessage?.body ?? '',
        });
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Unread messages email for ${conversation.id} failed: ${(error as Error).message}`,
        );
      }
    }
    return sent;
  }
}
