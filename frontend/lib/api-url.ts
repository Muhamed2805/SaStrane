const API_PORT = 4000;

// In the browser, default to whatever host served the page (works for
// localhost and for LAN IPs like 192.168.x.x without hardcoding one).
// On the server (SSR), the backend always runs on the same machine.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined'
    ? `http://${window.location.hostname}:${API_PORT}`
    : `http://localhost:${API_PORT}`);
