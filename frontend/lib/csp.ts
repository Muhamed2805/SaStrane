// The Content-Security-Policy of every page. A script runs only when it
// carries the nonce of its request, or was loaded by a script that does
// ('strict-dynamic'), so markup that a user managed to inject cannot run
// code. See proxy.ts.
export function contentSecurityPolicy(nonce: string, isDevelopment: boolean) {
  const directives = [
    "default-src 'self'",
    // React needs eval in development only, to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    // Toasts and the framework add style elements and attributes at run
    // time, which cannot carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    // Photos come from the storage's own address, which differs per
    // deployment: any HTTPS host, and the local storage in development.
    "img-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*",
    "font-src 'self' data:",
    // The API is called on this site's own origin (see next.config.ts).
    // Development adds the hot-reload socket.
    `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}
