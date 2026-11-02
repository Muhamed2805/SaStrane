import { isServer, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

// Queries that belong to the signed-in user start with this key, followed
// by the user's ID. Signing out removes them all.
export const USER_SCOPE = 'user';

// A client error such as 404 will not change on a retry. A network error or
// a 5xx might.
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data rendered on the server is not fetched again right after the
        // page hydrates.
        staleTime: 30_000,
        // A page rendered on the server does not wait for retries. The
        // browser fetches what failed.
        retry: isServer ? false : shouldRetry,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// The server needs a new client per request, so users never share data.
// The browser keeps one client for the whole visit.
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

// Drops the cached data of every user except keepUserId.
export function removeUserQueries(keepUserId?: string) {
  getQueryClient().removeQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === USER_SCOPE && queryKey[1] !== keepUserId,
  });
}
