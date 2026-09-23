import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

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
};

export default nextConfig;
