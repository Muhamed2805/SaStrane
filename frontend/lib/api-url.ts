// Browsers reach the API through this app's /api proxy (see next.config.ts),
// so the refresh cookie belongs to the site itself. Server-side rendering
// calls the backend directly.
export const API_URL =
  typeof window !== 'undefined'
    ? '/api'
    : `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api`;
