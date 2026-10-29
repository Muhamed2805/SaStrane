import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

function createService(values: Record<string, string | undefined>) {
  const config = { get: jest.fn((key: string) => values[key]) };
  return new EmailService(config as unknown as ConfigService);
}

const input = { email: 'user@example.com', fullName: 'Test', code: '123456' };

describe('EmailService', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
