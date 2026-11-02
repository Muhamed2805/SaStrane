import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConversationsService } from './conversations.service.js';

describe('ConversationsService', () => {
  const listingRepository = { findUnique: vi.fn() };
  const applicationRepository = { findUnique: vi.fn() };
  const conversationRepository = {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  };
  const messageRepository = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const prisma = {
    listing: listingRepository,
    application: applicationRepository,
    conversation: conversationRepository,
    message: messageRepository,
    $transaction: vi.fn(),
  };

  const service = new ConversationsService(prisma as unknown as PrismaService);

  const row = {
    id: 'conversation-1',
    clientId: 'client-1',
    executorId: 'executor-1',
    clientUnread: 2,
    executorUnread: 0,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    listing: { id: 'listing-1', title: 'Selidba', status: 'OPEN' },
    client: { id: 'client-1', fullName: 'Amra Hodžić' },
    executor: { id: 'executor-1', fullName: 'Kenan Mehić' },
    lastMessage: null,
  };

  const openListing = { id: 'listing-1', clientId: 'client-1', status: 'OPEN' };

  beforeEach(() => {
    vi.resetAllMocks();
    // The transaction runs its callback with the same repositories.
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  describe('start', () => {
    it('returns the existing conversation as the side who asks sees it', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      conversationRepository.findUnique.mockResolvedValue(row);

      await expect(
        service.start({ listingId: 'listing-1' }, 'executor-1'),
      ).resolves.toMatchObject({
        id: 'conversation-1',
        role: 'EXECUTOR',
        otherUser: { id: 'client-1' },
        unreadCount: 0,
      });
      expect(conversationRepository.create).not.toHaveBeenCalled();
    });

    it('creates a conversation with the client of an open job', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      conversationRepository.findUnique.mockResolvedValue(null);
      conversationRepository.create.mockResolvedValue(row);

      await service.start({ listingId: 'listing-1' }, 'executor-1');

      expect(conversationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            listingId: 'listing-1',
            clientId: 'client-1',
            executorId: 'executor-1',
          },
        }),
      );
    });

    it('returns 404 for an unknown job', async () => {
      listingRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.start({ listingId: 'missing' }, 'executor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not let the client write to themselves', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);

      await expect(
        service.start({ listingId: 'listing-1' }, 'client-1'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.start(
          { listingId: 'listing-1', executorId: 'client-1' },
          'client-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets only the client choose who to write to', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);

      await expect(
        service.start(
          { listingId: 'listing-1', executorId: 'someone-else' },
          'executor-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets the client write only to a user who applied', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      conversationRepository.findUnique.mockResolvedValue(null);
      applicationRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.start(
          { listingId: 'listing-1', executorId: 'executor-1' },
          'client-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(conversationRepository.create).not.toHaveBeenCalled();
    });

    it('lets the client write to an applicant of a closed job', async () => {
      listingRepository.findUnique.mockResolvedValue({
        ...openListing,
        status: 'CLOSED',
      });
      conversationRepository.findUnique.mockResolvedValue(null);
      applicationRepository.findUnique.mockResolvedValue({ id: 'app-1' });
      conversationRepository.create.mockResolvedValue(row);

      await expect(
        service.start(
          { listingId: 'listing-1', executorId: 'executor-1' },
          'client-1',
        ),
      ).resolves.toMatchObject({ role: 'CLIENT', unreadCount: 2 });
    });

    it('starts no new conversation about a closed job', async () => {
      listingRepository.findUnique.mockResolvedValue({
        ...openListing,
        status: 'CLOSED',
      });
      conversationRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.start({ listingId: 'listing-1' }, 'executor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('returns the other conversation when both sides start one at once', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      conversationRepository.findUnique.mockResolvedValue(null);
      conversationRepository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      conversationRepository.findUniqueOrThrow.mockResolvedValue(row);

      await expect(
        service.start({ listingId: 'listing-1' }, 'executor-1'),
      ).resolves.toMatchObject({ id: 'conversation-1' });
    });
  });

  describe('reading', () => {
    it('keeps other users out of a conversation', async () => {
      conversationRepository.findUnique.mockResolvedValue(row);

      await expect(
        service.getById('conversation-1', 'stranger'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getMessages('conversation-1', 'stranger', {}),
      ).rejects.toThrow(ForbiddenException);
      expect(messageRepository.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown conversation', async () => {
      conversationRepository.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing', 'client-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('gives a cursor only when older messages exist', async () => {
      conversationRepository.findUnique.mockResolvedValue(row);
      const message = (id: string) => ({ id, senderId: 'client-1', body: id });
      messageRepository.findMany.mockResolvedValueOnce([
        message('m3'),
        message('m2'),
        message('m1'),
      ]);
      messageRepository.findMany.mockResolvedValueOnce([message('m1')]);

      await expect(
        service.getMessages('conversation-1', 'client-1', { limit: 2 }),
      ).resolves.toMatchObject({
        items: [{ id: 'm3' }, { id: 'm2' }],
        nextCursor: 'm2',
      });
      messageRepository.findUnique.mockResolvedValue({
        conversationId: 'conversation-1',
      });
      await expect(
        service.getMessages('conversation-1', 'client-1', {
          limit: 2,
          before: 'm2',
        }),
      ).resolves.toMatchObject({ items: [{ id: 'm1' }], nextCursor: null });
      expect(messageRepository.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: { id: 'm2' }, skip: 1, take: 3 }),
      );
    });

    it('rejects a cursor from another conversation', async () => {
      conversationRepository.findUnique.mockResolvedValue(row);
      messageRepository.findUnique.mockResolvedValue({
        conversationId: 'conversation-2',
      });

      await expect(
        service.getMessages('conversation-1', 'client-1', { before: 'm9' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('adds up the unread messages of both sides', async () => {
      conversationRepository.aggregate
        .mockResolvedValueOnce({ _sum: { clientUnread: 3 } })
        .mockResolvedValueOnce({ _sum: { executorUnread: null } });

      await expect(service.getUnreadCount('user-1')).resolves.toEqual({
        count: 3,
      });
    });
  });

  describe('send', () => {
    it('counts the message as unread for the other side only', async () => {
      conversationRepository.findUnique.mockResolvedValue(row);
      const message = {
        id: 'm1',
        senderId: 'executor-1',
        body: 'Mogu doći sutra.',
        createdAt: new Date('2026-11-02T09:00:00Z'),
      };
      messageRepository.create.mockResolvedValue(message);

      await expect(
        service.send('conversation-1', { body: message.body }, 'executor-1'),
      ).resolves.toEqual(message);
      expect(conversationRepository.update).toHaveBeenCalledWith({
        where: { id: 'conversation-1' },
        data: {
          lastMessageId: 'm1',
          lastMessageAt: message.createdAt,
          executorUnread: 0,
          clientUnread: { increment: 1 },
        },
      });
    });

    it('marks the conversation as read for the side who asks', async () => {
      conversationRepository.findUnique.mockResolvedValue(row);

      await service.markRead('conversation-1', 'client-1');

      expect(conversationRepository.update).toHaveBeenCalledWith({
        where: { id: 'conversation-1' },
        data: { clientUnread: 0 },
      });
    });
  });
});
