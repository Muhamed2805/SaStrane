import {
  infiniteQueryOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { nextPageParam, WORKSPACE_PAGE_SIZE } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import { listingsApi, type GetAllListingsParams, type Listing } from './api';

export const listingKeys = {
  all: ['listings'] as const,
  lists: () => [...listingKeys.all, 'list'] as const,
  list: (params: GetAllListingsParams) =>
    [...listingKeys.lists(), params] as const,
  detail: (id: string) => [...listingKeys.all, 'detail', id] as const,
  // The signed-in user's own jobs, in the workspace.
  owned: (userId: string) => [USER_SCOPE, userId, 'listings'] as const,
};

export function listingsQuery(params: GetAllListingsParams) {
  return queryOptions({
    queryKey: listingKeys.list(params),
    queryFn: ({ signal }) => listingsApi.getAll(params, signal),
  });
}

export function listingQuery(id: string) {
  return queryOptions({
    queryKey: listingKeys.detail(id),
    queryFn: ({ signal }) => listingsApi.getById(id, signal),
  });
}

export function ownedListingsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: listingKeys.owned(userId),
    queryFn: ({ pageParam, signal }) =>
      listingsApi.getAll(
        { clientId: userId, page: pageParam, limit: WORKSPACE_PAGE_SIZE },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

// After a job is created or changed. The job is stored as the API returned
// it, and the lists that may show it are fetched again.
export function listingSaved(
  queryClient: QueryClient,
  userId: string,
  listing: Listing,
) {
  queryClient.setQueryData(listingKeys.detail(listing.id), listing);
  void queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: listingKeys.owned(userId) });
}
