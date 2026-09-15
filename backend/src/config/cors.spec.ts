import { isCorsOriginAllowed, parseCorsOrigins } from './cors';

describe('CORS configuration', () => {
  describe('parseCorsOrigins', () => {
    it('normalizes a comma-separated allowlist', () => {
      expect(
        parseCorsOrigins(
          ' https://app.example.com/, http://admin.example.com:3000 ',
        ),
      ).toEqual(
        new Set(['https://app.example.com', 'http://admin.example.com:3000']),
      );
    });
  });

  describe('isCorsOriginAllowed', () => {
    const noConfiguredOrigins = new Set<string>();

    it('allows requests without an Origin header', () => {
      expect(isCorsOriginAllowed(undefined, noConfiguredOrigins, true)).toBe(
        true,
      );
    });

    it.each([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://192.168.1.25:3000',
      'http://10.0.0.8:8080',
      'http://172.16.0.10:3002',
      'http://172.31.255.255:3002',
    ])('allows the development origin %s', (origin) => {
      expect(isCorsOriginAllowed(origin, noConfiguredOrigins, false)).toBe(
        true,
      );
    });

    it.each([
      'http://example.com:3000',
      'ftp://localhost:3000',
      'http://172.32.0.1:3000',
      'http://192.169.1.1:3000',
      'not-an-origin',
    ])('rejects the untrusted development origin %s', (origin) => {
      expect(isCorsOriginAllowed(origin, noConfiguredOrigins, false)).toBe(
        false,
      );
    });

    it('allows only configured browser origins in production', () => {
      const allowedOrigins = parseCorsOrigins(
        'https://app.example.com,https://admin.example.com',
      );

      expect(
        isCorsOriginAllowed('https://app.example.com', allowedOrigins, true),
      ).toBe(true);
      expect(
        isCorsOriginAllowed('http://localhost:3000', allowedOrigins, true),
      ).toBe(false);
      expect(
        isCorsOriginAllowed('https://evil.example.com', allowedOrigins, true),
      ).toBe(false);
    });
  });
});
