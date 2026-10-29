import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from './api';

type SessionModule = typeof import('./session');

const API_URL = 'http://localhost:4000/api';
const user: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Test User',
  role: 'BOTH',
  createdAt: '2026-09-15T12:00:00.000Z',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sessionResponse(accessToken: string) {
  return jsonResponse(200, { user, accessToken });
}

// Stands in for the tabs of one browser: a message reaches every other
// channel with the same name, but not the one that sent it.
class FakeBroadcastChannel {
  static open: FakeBroadcastChannel[] = [];
  private readonly listeners: Array<(event: MessageEvent) => void> = [];

  constructor(readonly name: string) {
    FakeBroadcastChannel.open.push(this);
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  postMessage(data: unknown) {
    for (const channel of FakeBroadcastChannel.open) {
      if (channel !== this && channel.name === this.name) {
        for (const listener of channel.listeners) {
          listener({ data } as MessageEvent);
        }
      }
    }
  }
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('auth session', () => {
  let session: SessionModule;
  let storage: ReturnType<typeof createStorage>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let lockRequests: string[];
  let changes: Array<AuthUser | null>;

  // The fetch calls made so far, as "METHOD /path Authorization".
  function requests() {
    return fetchMock.mock.calls.map(([url, init]) => {
      const options = (init ?? {}) as RequestInit;
      const auth = new Headers(options.headers).get('Authorization');
      const path = String(url).replace(API_URL, '');
      return [options.method ?? 'GET', path, auth].filter(Boolean).join(' ');
    });
  }

  // A message from another tab of the same browser.
  function messageFromOtherTab(type: 'signed-in' | 'signed-out') {
    new FakeBroadcastChannel('sastrane:auth').postMessage({ type });
  }

  beforeEach(async () => {
    vi.resetModules();
    FakeBroadcastChannel.open = [];
    storage = createStorage();
    fetchMock = vi.fn();
    lockRequests = [];
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.stubGlobal('navigator', {
      locks: {
        request: (name: string, task: () => Promise<unknown>) => {
          lockRequests.push(name);
          return task();
        },
      },
    });

    session = await import('./session');
    changes = [];
    session.subscribeToSession((next) => changes.push(next));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the refresh request for a visitor who never signed in', async () => {
    await session.initializeSession();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes).toEqual([null]);
  });

  it('restores the session from the refresh cookie on page load', async () => {
    storage.setItem('sastrane:signed-in', '1');
    fetchMock.mockResolvedValueOnce(sessionResponse('token-1'));

    await session.initializeSession();

    expect(requests()).toEqual(['POST /auth/refresh']);
    expect(changes).toEqual([user]);
    expect(lockRequests).toEqual(['sastrane:auth-refresh']);
  });

  it('sends the access token and keeps it out of storage', async () => {
    session.startSession({ user, accessToken: 'token-1' });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await session.authRequest('/applications/my/listing-ids');

    expect(requests()).toEqual([
      'GET /applications/my/listing-ids Bearer token-1',
    ]);
    expect([...storage.values]).toEqual([['sastrane:signed-in', '1']]);
  });

  it('refreshes an expired access token once and repeats the request', async () => {
    session.startSession({ user, accessToken: 'expired-token' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(sessionResponse('token-2'))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'listing-1' }));

    await expect(
      session.authRequest('/listings', { method: 'POST', body: '{}' }),
    ).resolves.toEqual({ id: 'listing-1' });

    expect(requests()).toEqual([
      'POST /listings Bearer expired-token',
      'POST /auth/refresh',
      'POST /listings Bearer token-2',
    ]);
  });

  it('shares one refresh between requests that fail at the same time', async () => {
    session.startSession({ user, accessToken: 'expired-token' });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(sessionResponse('token-2'));
      }
      const auth = new Headers(init?.headers).get('Authorization');
      return Promise.resolve(
        auth === 'Bearer token-2'
          ? jsonResponse(200, [])
          : jsonResponse(401, { message: 'Unauthorized' }),
      );
    });

    await Promise.all([
      session.authRequest('/applications/my'),
      session.authRequest('/applications/received'),
      session.authRequest('/applications/my/listing-ids'),
    ]);

    expect(requests().filter((call) => call.includes('/auth/refresh'))).toEqual(
      ['POST /auth/refresh'],
    );
  });

  it('signs out every tab when the refresh cookie is rejected', async () => {
    const otherTab = new FakeBroadcastChannel('sastrane:auth');
    const otherTabMessages: unknown[] = [];
    otherTab.addEventListener('message', (event) =>
      otherTabMessages.push(event.data),
    );
    session.startSession({ user, accessToken: 'expired-token' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }));

    await expect(session.authRequest('/applications/my')).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: 'Sesija je istekla. Prijavi se ponovo.',
      }),
    );

    expect(changes).toEqual([user, null]);
    expect(storage.getItem('sastrane:signed-in')).toBeNull();
    expect(otherTabMessages).toEqual([
      { type: 'signed-in' },
      { type: 'signed-out' },
    ]);
  });

  it('keeps the session when the refresh fails for a temporary reason', async () => {
    session.startSession({ user, accessToken: 'expired-token' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(429, { message: 'Too Many' }));

    await expect(session.authRequest('/applications/my')).rejects.toEqual(
      expect.objectContaining({ status: 429 }),
    );

    expect(changes).toEqual([user]);
    expect(storage.getItem('sastrane:signed-in')).toBe('1');
  });

  it('ends the session on the server when signing out', async () => {
    session.startSession({ user, accessToken: 'token-1' });
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));

    session.signOut();

    expect(changes).toEqual([user, null]);
    expect(storage.getItem('sastrane:signed-in')).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/auth/logout`);
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
    // Signed out, so authenticated requests fail without a network call.
    await expect(session.authRequest('/applications/my')).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not let a refresh under way sign the user back in after logout', async () => {
    storage.setItem('sastrane:signed-in', '1');
    let finishRefresh: (response: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishRefresh = resolve;
          }),
      )
      .mockResolvedValue(jsonResponse(204, null));

    const refresh = session.refreshSession();
    session.signOut();
    finishRefresh(sessionResponse('late-token'));

    await expect(refresh).resolves.toBeNull();
    expect(changes).toEqual([null]);
  });

  it('follows another tab that signs out', async () => {
    await session.initializeSession();
    session.startSession({ user, accessToken: 'token-1' });

    messageFromOtherTab('signed-out');

    expect(changes.at(-1)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('picks up a session that another tab started', async () => {
    await session.initializeSession();
    fetchMock.mockResolvedValueOnce(sessionResponse('token-from-cookie'));

    messageFromOtherTab('signed-in');
    await vi.waitFor(() => expect(changes.at(-1)).toEqual(user));

    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    await session.authRequest('/applications/my');
    expect(requests().at(-1)).toBe(
      'GET /applications/my Bearer token-from-cookie',
    );
  });

  it('works without Web Locks or storage', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('localStorage', undefined);
    fetchMock.mockResolvedValueOnce(sessionResponse('token-1'));

    // Without the hint the server decides whether a session exists.
    await session.initializeSession();

    expect(requests()).toEqual(['POST /auth/refresh']);
    expect(changes).toEqual([user]);
  });
});
