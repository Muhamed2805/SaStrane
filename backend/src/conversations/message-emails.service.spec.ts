import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MESSAGE_EMAIL_DELAY_MS,
  MessageEmailsService,
} from './message-emails.service.js';

type Where = Record<string, unknown>;

describe('MessageEmailsService', () => {
  const conversationRepository = {
    findMany: vi.fn<(args: { where: Where }) => Promise<unknown[]>>(),
    updateMany:
      vi.fn<
        (args: { where: Where; data: Where }) => Promise<{ count: number }>
      >(),
  };
  const email = {
    sendUnreadMessages: vi.fn<(input: unknown) => Promise<void>>(),
  };
  const config = { get: vi.fn<(key: string) => string | undefined>() };

  const service = new MessageEmailsService(
    { conversation: conversationRepository } as unknown as PrismaService,
    email as unknown as EmailService,
    config as unknown as ConfigService,
  );

  let logged: ReturnType<typeof vi.spyOn>;
  const now = new Date('2026-11-06T12:00:00Z');
  const cutoff = new Date(now.getTime() - MESSAGE_EMAIL_DELAY_MS);

  const conversation = {
    id: 'conversation-1',
    clientUnread: 0,
    executorUnread: 3,
    listing: { title: 'Košenje trave' },
    client: { email: 'amra@example.com', fullName: 'Amra' },
    executor: { email: 'kenan@example.com', fullName: 'Kenan' },
    lastMessage: { body: 'Može u subotu?' },
  };

  // The executor side has one conversation due, the client side none.
  function dueForExecutor() {
    conversationRepository.findMany.mockImplementation(({ where }) =>
      Promise.resolve('executorUnread' in where ? [conversation] : []),
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    conversationRepository.updateMany.mockResolvedValue({ count: 1 });
    email.sendUnreadMessages.mockResolvedValue();
    logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emails the side with messages unread for long enough', async () => {
    dueForExecutor();

    await expect(service.sendDue(now)).resolves.toBe(1);

    expect(conversationRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          executorUnread: { gt: 0 },
          executorUnreadSince: { lte: cutoff },
          executorEmailedAt: null,
          executor: { emailNotifications: true },
        },
      }),
    );
    expect(conversationRepository.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conversation-1',
        executorUnread: { gt: 0 },
        executorEmailedAt: null,
      },
      data: { executorEmailedAt: now },
    });
    expect(email.sendUnreadMessages).toHaveBeenCalledWith({
      email: 'kenan@example.com',
      fullName: 'Kenan',
      conversationId: 'conversation-1',
      listingTitle: 'Košenje trave',
      senderName: 'Amra',
      unreadCount: 3,
      lastMessage: 'Može u subotu?',
    });
  });

  it('skips a conversation that was read or emailed in the meantime', async () => {
    dueForExecutor();
    conversationRepository.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.sendDue(now)).resolves.toBe(0);

    expect(email.sendUnreadMessages).not.toHaveBeenCalled();
  });

  it('logs a failed email and goes on', async () => {
    dueForExecutor();
    email.sendUnreadMessages.mockRejectedValue(new Error('provider down'));

    await expect(service.sendDue(now)).resolves.toBe(0);

    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('provider down'),
    );
  });

  it('survives a database error', async () => {
    conversationRepository.findMany.mockRejectedValue(new Error('db down'));

    await expect(service.sendDue(now)).resolves.toBe(0);

    expect(logged).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  it('does not start a check while one is running', async () => {
    let finish: (rows: unknown[]) => void = () => undefined;
    conversationRepository.findMany.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    conversationRepository.findMany.mockResolvedValue([]);

    const first = service.sendDue(now);
    await expect(service.sendDue(now)).resolves.toBe(0);
    finish([]);
    await first;

    expect(conversationRepository.findMany).toHaveBeenCalledTimes(2);
  });

  it('checks once a minute, except in tests', () => {
    vi.useFakeTimers();
    const check = vi.spyOn(service, 'sendDue').mockResolvedValue(0);

    config.get.mockReturnValue('test');
    service.onApplicationBootstrap();
    vi.advanceTimersByTime(60_000);
    expect(check).not.toHaveBeenCalled();

    config.get.mockReturnValue('development');
    service.onApplicationBootstrap();
    vi.advanceTimersByTime(60_000);
    expect(check).toHaveBeenCalledOnce();

    service.onModuleDestroy();
    vi.advanceTimersByTime(60_000);
    expect(check).toHaveBeenCalledOnce();
    check.mockRestore();
  });
});
