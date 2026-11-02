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
