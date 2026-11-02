import { describe, expect, it } from 'vitest';
import { ApiError } from './api-client';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError('Nije pronađeno.', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('Sesija je istekla.', 401))).toBe(false);
  });

  it('retries network and server errors once', () => {
    const networkError = new ApiError('Nema veze.', 0);
    expect(shouldRetry(0, networkError)).toBe(true);
    expect(shouldRetry(1, networkError)).toBe(false);
    expect(shouldRetry(0, new ApiError('Server nije dostupan.', 503))).toBe(
      true,
    );
  });
});
