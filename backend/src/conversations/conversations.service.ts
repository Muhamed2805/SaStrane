import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ListingStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConversationRole } from './dto/conversation-response.dto.js';
import {
  ConversationsQueryDto,
  MessagesQueryDto,
} from './dto/conversations-query.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { StartConversationDto } from './dto/start-conversation.dto.js';

// The fields of MessageDto.
const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  body: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

const USER_SELECT = {
  select: { id: true, fullName: true },
} satisfies Prisma.UserDefaultArgs;

const CONVERSATION_SELECT = {
  id: true,
  clientId: true,
  executorId: true,
  clientUnread: true,
  executorUnread: true,
  createdAt: true,
  listing: { select: { id: true, title: true, status: true } },
  client: USER_SELECT,
  executor: USER_SELECT,
  lastMessage: { select: MESSAGE_SELECT },
} satisfies Prisma.ConversationSelect;

type ConversationRow = Prisma.ConversationGetPayload<{
  select: typeof CONVERSATION_SELECT;
}>;

// One side has read the conversation. It can get an email again for the
// next unread message.
const READ_BY_CLIENT = {
  clientUnread: 0,
  clientUnreadSince: null,
  clientEmailedAt: null,
} satisfies Prisma.ConversationUpdateInput;

const READ_BY_EXECUTOR = {
  executorUnread: 0,
  executorUnreadSince: null,
  executorEmailedAt: null,
} satisfies Prisma.ConversationUpdateInput;

// Newest first. The ID orders messages sent in the same millisecond.
const NEWEST_FIRST = [
  { createdAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.MessageOrderByWithRelationInput[];

function roleOf(
  conversation: { clientId: string; executorId: string },
  userId: string,
): ConversationRole {
  if (conversation.clientId === userId) return 'CLIENT';
  if (conversation.executorId === userId) return 'EXECUTOR';
  throw new ForbiddenException('Not your conversation');
}

// The conversation as the signed-in user sees it.
function toDto(conversation: ConversationRow, userId: string) {
  const role = roleOf(conversation, userId);
  return {
    id: conversation.id,
    listing: conversation.listing,
    role,
    otherUser: role === 'CLIENT' ? conversation.executor : conversation.client,
    lastMessage: conversation.lastMessage,
    unreadCount:
      role === 'CLIENT'
        ? conversation.clientUnread
        : conversation.executorUnread,
    createdAt: conversation.createdAt,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns the conversation about the job, and creates it the first time.
  async start(dto: StartConversationDto, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, clientId: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const isClient = listing.clientId === userId;
    if (!isClient && dto.executorId && dto.executorId !== userId) {
      throw new ForbiddenException(
        'Only the client can choose who to write to',
      );
    }
    const executorId = isClient ? dto.executorId : userId;
    if (!executorId || executorId === listing.clientId) {
      throw new ForbiddenException('You cannot write to yourself');
    }

    const where = {
      listingId_executorId: { listingId: listing.id, executorId },
    };
    const existing = await this.prisma.conversation.findUnique({
      where,
      select: CONVERSATION_SELECT,
    });
    if (existing) return toDto(existing, userId);

    if (isClient) {
      // The client writes only to people who applied, never to anyone.
      const application = await this.prisma.application.findUnique({
        where,
        select: { id: true },
      });
      if (!application) {
        throw new ForbiddenException('This user has not applied to the job');
      }
    } else if (listing.status !== ListingStatus.OPEN) {
      throw new ConflictException({
        code: 'LISTING_CLOSED',
        message: 'Ovaj oglas je zatvoren za nove razgovore.',
      });
    }

    try {
      return toDto(
        await this.prisma.conversation.create({
          data: {
            listingId: listing.id,
            clientId: listing.clientId,
            executorId,
          },
          select: CONVERSATION_SELECT,
        }),
        userId,
      );
    } catch (error) {
      // Both sides started it at the same moment: use the other one.
      if (!isUniqueViolation(error)) throw error;
      return toDto(
        await this.prisma.conversation.findUniqueOrThrow({
          where,
          select: CONVERSATION_SELECT,
        }),
        userId,
      );
    }
  }

  async getAll(userId: string, query: ConversationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      OR: [{ clientId: userId }, { executorId: userId }],
      lastMessageAt: { not: null },
    } satisfies Prisma.ConversationWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: CONVERSATION_SELECT,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items: items.map((item) => toDto(item, userId)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string) {
    const [asClient, asExecutor] = await Promise.all([
      this.prisma.conversation.aggregate({
        where: { clientId: userId },
        _sum: { clientUnread: true },
      }),
      this.prisma.conversation.aggregate({
        where: { executorId: userId },
        _sum: { executorUnread: true },
      }),
    ]);

    return {
      count:
        (asClient._sum.clientUnread ?? 0) +
        (asExecutor._sum.executorUnread ?? 0),
    };
  }

  async getById(id: string, userId: string) {
    return toDto(await this.findForUser(id, userId), userId);
  }

  async getMessages(id: string, userId: string, query: MessagesQueryDto) {
    await this.findForUser(id, userId);
    const limit = query.limit ?? 30;

    if (query.before) {
      const cursor = await this.prisma.message.findUnique({
        where: { id: query.before },
        select: { conversationId: true },
      });
      if (cursor?.conversationId !== id) {
        throw new NotFoundException('Message not found');
      }
    }

    // One extra row tells whether older messages exist.
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: NEWEST_FIRST,
      take: limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      select: MESSAGE_SELECT,
    });
    const items = rows.slice(0, limit);

    return {
      items,
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
    };
  }

  async send(id: string, dto: SendMessageDto, userId: string) {
    const role = roleOf(await this.findForUser(id, userId), userId);

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId: id, senderId: userId, body: dto.body },
        select: MESSAGE_SELECT,
      });
      // The sender has seen the whole conversation. The other side has one
      // more unread message.
      await tx.conversation.update({
        where: { id },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
          ...(role === 'CLIENT'
            ? { ...READ_BY_CLIENT, executorUnread: { increment: 1 } }
            : { ...READ_BY_EXECUTOR, clientUnread: { increment: 1 } }),
        },
      });
      // The other side's first unread message starts the wait for an email
      // (see MessageEmailsService).
      const firstUnread: Prisma.ConversationUpdateManyArgs =
        role === 'CLIENT'
          ? {
              where: { id, executorUnreadSince: null },
              data: { executorUnreadSince: message.createdAt },
            }
          : {
              where: { id, clientUnreadSince: null },
              data: { clientUnreadSince: message.createdAt },
            };
      await tx.conversation.updateMany(firstUnread);
      return message;
    });
  }

  async markRead(id: string, userId: string) {
    const role = roleOf(await this.findForUser(id, userId), userId);
    await this.prisma.conversation.update({
      where: { id },
      data: role === 'CLIENT' ? READ_BY_CLIENT : READ_BY_EXECUTOR,
    });
  }

  private async findForUser(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: CONVERSATION_SELECT,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    roleOf(conversation, userId);
    return conversation;
  }
}
