import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: lets the dev server be reached from other devices on the
  // same LAN (e.g. testing from a phone). Update this IP if your machine's
  // network address changes.
  allowedDevOrigins: ["192.168.0.20"],
};

export default nextConfig;
