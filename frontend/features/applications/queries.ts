import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { nextPageParam, WORKSPACE_PAGE_SIZE } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import {
  applicationsApi,
  type ListingApplication,
  type ReceivedApplicationsPage,
} from './api';

// Every application query belongs to the signed-in user.
export const applicationKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'applications'] as const,
  sent: (userId: string) => [...applicationKeys.all(userId), 'sent'] as const,
  appliedListingIds: (userId: string) =>
    [...applicationKeys.all(userId), 'applied-listing-ids'] as const,
  received: (userId: string) =>
    [...applicationKeys.all(userId), 'received'] as const,
  forListing: (userId: string, listingId: string) =>
    [...applicationKeys.all(userId), 'listing', listingId] as const,
};

export function sentApplicationsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: applicationKeys.sent(userId),
    queryFn: ({ pageParam }) =>
      applicationsApi.getMyApplications({
        page: pageParam,
        limit: WORKSPACE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function receivedApplicationsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: applicationKeys.received(userId),
    queryFn: ({ pageParam }) =>
      applicationsApi.getReceivedApplications({
        page: pageParam,
        limit: WORKSPACE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

// Defined once, so the set is built again only when the data changes.
const toSet = (listingIds: string[]) => new Set(listingIds);

// The jobs the user applied to, as a set for quick lookups.
export function appliedListingIdsQuery(userId: string) {
  return queryOptions({
    queryKey: applicationKeys.appliedListingIds(userId),
    queryFn: () => applicationsApi.getAppliedListingIds(),
    select: toSet,
  });
}

export function listingApplicationsQuery(userId: string, listingId: string) {
  return queryOptions({
    queryKey: applicationKeys.forListing(userId, listingId),
    queryFn: () => applicationsApi.getForListing(listingId),
  });
}

// After the client decides on an application. The lists show the decision
// at once, then load again in case something else changed.
export function applicationDecided(
  queryClient: QueryClient,
  userId: string,
  updated: ListingApplication,
) {
  queryClient.setQueryData<InfiniteData<ReceivedApplicationsPage>>(
    applicationKeys.received(userId),
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          ),
        })),
      },
  );
  queryClient.setQueryData<ListingApplication[]>(
    applicationKeys.forListing(userId, updated.listingId),
    (items) => items?.map((item) => (item.id === updated.id ? updated : item)),
  );
  void queryClient.invalidateQueries({
    queryKey: applicationKeys.all(userId),
  });
}
