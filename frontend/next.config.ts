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

const nextConfig: NextConfig = {
  // Resolve current LAN addresses at startup so DHCP changes cannot leave
  // remote browsers with HTML but blocked JavaScript chunks.
  allowedDevOrigins: getLanDevOrigins(),
  // Browsers call the API on this site's own origin. The refresh cookie is
  // then first-party, so SameSite=Strict works even when the backend is
  // hosted on another domain, and the browser needs no CORS.
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
