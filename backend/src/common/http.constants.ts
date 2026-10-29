// Every route except the health check is served under /api. The frontend
// proxies the same path, so cookie paths match in both places.
export const API_PREFIX = 'api';
