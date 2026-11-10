import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './csp';

function directive(policy: string, name: string) {
  return policy.split('; ').find((part) => part.startsWith(`${name} `));
}

describe('contentSecurityPolicy', () => {
  it('lets only scripts with the nonce of the request run', () => {
    const policy = contentSecurityPolicy('abc123', false);

    expect(directive(policy, 'script-src')).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(policy).not.toContain('unsafe-eval');
    expect(directive(policy, 'script-src')).not.toContain('unsafe-inline');
  });

  it('allows eval and the hot-reload socket in development only', () => {
    const policy = contentSecurityPolicy('abc123', true);

    expect(directive(policy, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(policy, 'connect-src')).toBe(
      "connect-src 'self' ws: wss:",
    );
    expect(
      directive(contentSecurityPolicy('abc123', false), 'connect-src'),
    ).toBe("connect-src 'self'");
  });

  it('keeps the site out of frames and its forms and base address at home', () => {
    const policy = contentSecurityPolicy('abc123', false);

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("default-src 'self'");
  });
});
