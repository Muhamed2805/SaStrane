import { API_URL } from '@/lib/api-url';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const STATUS_MESSAGES: Partial<Record<number, string>> = {
  400: 'Uneseni podaci nisu ispravni.',
  401: 'Sesija je istekla. Prijavi se ponovo.',
  403: 'Nemaš dozvolu za ovu radnju.',
  404: 'Traženi sadržaj nije pronađen.',
  409: 'Zahtjev nije moguće izvršiti zbog konflikta podataka.',
  429: 'Previše pokušaja. Sačekaj malo pa pokušaj ponovo.',
};

function parseResponseBody(text: string): unknown {
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, status: number): string {
  if (status >= 500) {
    return 'Server trenutno nije dostupan. Pokušaj ponovo kasnije.';
  }

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message;

    if (Array.isArray(message)) {
      const messages = message.filter(
        (item): item is string => typeof item === 'string',
      );
      if (messages.length > 0) return messages.join(' ');
    }

    if (
      'code' in payload &&
      typeof payload.code === 'string' &&
      typeof message === 'string' &&
      message.trim()
    ) {
      return message;
    }

    if (status === 400 && typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  const statusMessage = STATUS_MESSAGES[status];
  if (statusMessage) return statusMessage;

  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string' &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return 'Zahtjev nije uspio. Pokušaj ponovo.';
}

function getErrorCode(payload: unknown): string | undefined {
  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    typeof payload.code === 'string'
  ) {
    return payload.code;
  }

  return undefined;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Nije moguće povezati se sa serverom. Provjeri mrežnu vezu.',
      0,
    );
  }

  const text = await response.text();
  const payload = parseResponseBody(text);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, response.status),
      response.status,
      getErrorCode(payload),
    );
  }

  return payload as T;
}
