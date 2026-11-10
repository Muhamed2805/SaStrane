import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from '@/lib/csp';

// Gives every page a Content-Security-Policy with a nonce of its own.
// Next.js reads the nonce from the request header while it renders and puts
// it on its scripts, so every page is rendered per request (see
// app/layout.tsx).
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
  );

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    // Pages only: not the API, which is forwarded to the backend, not the
    // static files, and not the prefetches of links, which carry no page.
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
