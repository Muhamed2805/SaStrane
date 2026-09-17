import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api-client';

const API_URL = 'http://localhost:4000';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('parses a successful JSON response and adds the content type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'listing-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest<{ id: string }>('/listings', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: JSON.stringify({ title: 'Montaža namještaja' }),
      }),
    ).resolves.toEqual({ id: 'listing-1' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);

    expect(url).toBe(`${API_URL}/listings`);
    expect(options.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not add a content type header to requests without a body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/listings');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(options.headers).has('Content-Type')).toBe(false);
  });

  it('joins backend validation messages for a bad request', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              message: ['Naslov je obavezan.', 'Budžet nije validan.'],
            }),
            { status: 400 },
          ),
        ),
    );

    await expect(apiRequest('/listings', { method: 'POST' })).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 400,
        message: 'Naslov je obavezan. Budžet nije validan.',
      }),
    );
  });

  it('uses a safe message instead of exposing server details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Database connection failed' }),
          {
            status: 500,
          },
        ),
      ),
    );

    await expect(apiRequest('/listings')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 500,
        message: 'Server trenutno nije dostupan. Pokušaj ponovo kasnije.',
      }),
    );
  });

  it('converts network failures into a user-safe ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const request = apiRequest('/listings');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        message: 'Nije moguće povezati se sa serverom. Provjeri mrežnu vezu.',
      }),
    );
  });

  it('preserves abort errors so callers can ignore cancelled requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    );

    await expect(apiRequest('/listings')).rejects.toEqual(
      expect.objectContaining({ name: 'AbortError' }),
    );
  });
});
