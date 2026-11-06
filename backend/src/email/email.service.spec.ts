import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

function createService(values: Record<string, string | undefined>) {
  const read = (key: string) => values[key];
  const config = {
    get: vi.fn(read),
    getOrThrow: vi.fn((key: string) => {
      const value = read(key);
      if (value === undefined) throw new Error(`${key} is missing`);
      return value;
    }),
  };
  return new EmailService(config as unknown as ConfigService);
}

const input = { email: 'user@example.com', fullName: 'Test', code: '123456' };

const decision = {
  email: 'kenan@example.com',
  fullName: 'Kenan',
  listingId: 'listing-1',
  listingTitle: 'Košenje <trave>',
  clientName: 'Amra',
  accepted: true,
};

type SentEmail = {
  to: string[];
  subject: string;
  html: string;
  tags: unknown[];
};

// The JSON body of the first request sent to Resend.
function sentBody(fetchMock: {
  mock: { calls: Parameters<typeof fetch>[] };
}): SentEmail {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(init?.body as string) as SentEmail;
}

describe('EmailService', () => {
  const fetchMock =
    vi.fn<(...args: Parameters<typeof fetch>) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the code instead of sending in development without an API key', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendVerificationCode(input);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to fall back to logging in production', async () => {
    const service = createService({ NODE_ENV: 'production' });

    await expect(service.sendVerificationCode(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('sends through Resend with a request timeout', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({ RESEND_API_KEY: 'key' });

    await service.sendPasswordResetCode(input);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends an accepted application email with a link to the job', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });

    await service.sendApplicationDecision(decision);

    const body = sentBody(fetchMock);
    expect(body.to).toEqual(['kenan@example.com']);
    expect(body.subject).toBe('Tvoja prijava je prihvaćena');
    expect(body.html).toContain('https://sastrane.example/listings/listing-1');
    expect(body.html).toContain('Košenje &lt;trave&gt;');
    expect(body.html).not.toContain('<trave>');
    expect(body.tags).toEqual([
      { name: 'category', value: 'application_decision' },
    ]);
  });

  it('sends a rejected application email that points to other jobs', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });

    await service.sendApplicationDecision({ ...decision, accepted: false });

    const body = sentBody(fetchMock);
    expect(body.subject).toBe('Odgovor na tvoju prijavu');
    expect(body.html).toContain('href="https://sastrane.example/listings"');
    expect(body.html).not.toContain('Amra');
  });

  it('sends a notice when the password was changed', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({ RESEND_API_KEY: 'key' });

    await service.sendPasswordChanged({
      email: 'amra@example.com',
      fullName: 'Amra <b>',
    });

    const body = sentBody(fetchMock);
    expect(body.to).toEqual(['amra@example.com']);
    expect(body.subject).toBe('Lozinka je promijenjena');
    expect(body.html).toContain('Amra &lt;b&gt;');
    expect(body.tags).toEqual([
      { name: 'category', value: 'password_changed' },
    ]);
  });

  it('tells a client about a new application', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });

    await service.sendNewApplication({
      email: 'amra@example.com',
      fullName: 'Amra',
      listingTitle: 'Košenje trave',
      executorName: 'Kenan <i>',
      proposedPrice: 1500,
      message: `Mogu doći u subotu.${'x'.repeat(400)}`,
    });

    const body = sentBody(fetchMock);
    expect(body.to).toEqual(['amra@example.com']);
    expect(body.subject).toBe('Nova prijava za oglas „Košenje trave“');
    expect(body.html).toContain('Kenan &lt;i&gt;');
    expect(body.html).toContain('1.500 KM');
    expect(body.html).toContain('…');
    expect(body.html).not.toContain('x'.repeat(400));
    expect(body.html).toContain(
      'href="https://sastrane.example/inbox?tab=received"',
    );
    expect(body.html).toContain('href="https://sastrane.example/settings"');
    expect(body.tags).toEqual([{ name: 'category', value: 'new_application' }]);
  });

  it('invites a user to a job with a link to it', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });

    await service.sendInvitation({
      email: 'kenan@example.com',
      fullName: 'Kenan',
      listingId: 'listing/1',
      listingTitle: 'Selidba <b>',
      clientName: 'Amra',
      budget: null,
    });

    const body = sentBody(fetchMock);
    expect(body.to).toEqual(['kenan@example.com']);
    expect(body.subject).toBe('Poziv na oglas „Selidba <b>“');
    expect(body.html).toContain('Amra te poziva');
    expect(body.html).toContain('Selidba &lt;b&gt;');
    expect(body.html).toContain('po dogovoru');
    expect(body.html).toContain(
      'href="https://sastrane.example/listings/listing%2F1"',
    );
    expect(body.html).toContain('href="https://sastrane.example/settings"');
    expect(body.tags).toEqual([{ name: 'category', value: 'invitation' }]);
  });

  it('warns a client before their job expires, and when it did', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });
    const input = {
      email: 'amra@example.com',
      fullName: 'Amra',
      listingId: 'listing-1',
      listingTitle: 'Selidba',
      // Late evening in UTC is already the next day in Sarajevo.
      expiresAt: new Date('2026-12-08T23:30:00.000Z'),
    };

    await service.sendListingExpiry({ ...input, expired: false });
    let body = sentBody(fetchMock);
    expect(body.subject).toBe('Oglas „Selidba“ uskoro ističe');
    expect(body.html).toContain('9. decembar 2026.');
    expect(body.html).toContain('Produži oglas');
    expect(body.html).toContain(
      'href="https://sastrane.example/listings/listing-1"',
    );
    expect(body.tags).toEqual([
      { name: 'category', value: 'listing_expiring' },
    ]);

    fetchMock.mockClear();
    await service.sendListingExpiry({ ...input, expired: true });
    body = sentBody(fetchMock);
    expect(body.subject).toBe('Oglas „Selidba“ je istekao');
    expect(body.html).toContain('ponovo otvoriti');
    expect(body.tags).toEqual([{ name: 'category', value: 'listing_expired' }]);
  });

  it('announces a job that matches an alert, with a link to it', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });

    await service.sendNewListingMatch({
      email: 'kenan@example.com',
      fullName: 'Kenan',
      listingId: 'listing/1',
      listingTitle: 'Selidba <b>',
      budget: 80,
    });

    const body = sentBody(fetchMock);
    expect(body.to).toEqual(['kenan@example.com']);
    expect(body.subject).toBe('Nov oglas: „Selidba <b>“');
    expect(body.html).toContain('odgovara tvom upozorenju');
    expect(body.html).toContain('Selidba &lt;b&gt;');
    expect(body.html).toContain('80 KM');
    expect(body.html).toContain(
      'href="https://sastrane.example/listings/listing%2F1"',
    );
    expect(body.tags).toEqual([
      { name: 'category', value: 'new_listing_match' },
    ]);
  });

  it('tells a user about unread messages with a link to the conversation', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const service = createService({
      RESEND_API_KEY: 'key',
      APP_URL: 'https://sastrane.example',
    });

    await service.sendUnreadMessages({
      email: 'kenan@example.com',
      fullName: 'Kenan',
      conversationId: 'conversation-1',
      listingTitle: 'Košenje trave',
      senderName: 'Amra',
      unreadCount: 3,
      lastMessage: 'Može u <subotu>?',
    });

    const body = sentBody(fetchMock);
    expect(body.subject).toBe('Nova poruka o oglasu „Košenje trave“');
    expect(body.html).toContain('3 nepročitane poruke');
    expect(body.html).toContain('Može u &lt;subotu&gt;?');
    expect(body.html).toContain(
      'href="https://sastrane.example/messages/conversation-1"',
    );
    expect(body.tags).toEqual([{ name: 'category', value: 'unread_messages' }]);
  });

  it('maps a network failure or timeout to 503', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    const service = createService({ RESEND_API_KEY: 'key' });

    await expect(service.sendVerificationCode(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('maps a rejected request to 503', async () => {
    fetchMock.mockResolvedValue(new Response('bad', { status: 422 }));
    const service = createService({ RESEND_API_KEY: 'key' });

    await expect(service.sendVerificationCode(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
