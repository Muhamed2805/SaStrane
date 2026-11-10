import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

// Read when `next build` or `next dev` starts: rewrites are fixed at build
// time, so set it in the build environment, not only at runtime.
const backendUrl = (process.env.BACKEND_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

function getLanDevOrigins() {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

// Sent with every page. The site is never shown inside another site's
// frame, which stops clickjacking, and a page cannot be given another base
// address or post its forms elsewhere. Scripts are not restricted here:
// that needs a nonce on every request.
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // Browsers follow this only over HTTPS, so it does nothing locally.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
];

const nextConfig: NextConfig = {
  // Resolve current LAN addresses at startup so DHCP changes cannot leave
  // remote browsers with HTML but blocked JavaScript chunks.
  allowedDevOrigins: getLanDevOrigins(),
  // Browsers call the API on this site's own origin. The refresh cookie is
  // then first-party, so SameSite=Strict works even when the backend is
  // hosted on another domain, and the browser needs no CORS.
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
