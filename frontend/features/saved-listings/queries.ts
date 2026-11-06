import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { nextPageParam, WORKSPACE_PAGE_SIZE } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import { savedListingsApi } from './api';

// Every saved-job query belongs to the signed-in user.
export const savedListingKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'saved-listings'] as const,
  ids: (userId: string) => [...savedListingKeys.all(userId), 'ids'] as const,
  list: (userId: string) => [...savedListingKeys.all(userId), 'list'] as const,
};

// Defined once, so the set is built again only when the data changes.
const toSet = (listingIds: string[]) => new Set(listingIds);

// The saved jobs as a set for quick lookups.
export function savedListingIdsQuery(userId: string) {
  return queryOptions({
    queryKey: savedListingKeys.ids(userId),
    queryFn: () => savedListingsApi.getIds(),
    select: toSet,
  });
}

export function savedListingsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: savedListingKeys.list(userId),
    queryFn: ({ pageParam }) =>
      savedListingsApi.getAll(pageParam, WORKSPACE_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}
