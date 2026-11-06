import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { nextPageParam, WORKSPACE_PAGE_SIZE } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import { invitationsApi } from './api';

// Every invitation query belongs to the signed-in user.
export const invitationKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'invitations'] as const,
  received: (userId: string) =>
    [...invitationKeys.all(userId), 'received'] as const,
  // Under received, so whatever reloads the list reloads this too.
  forListing: (userId: string, listingId: string) =>
    [...invitationKeys.received(userId), 'listing', listingId] as const,
  options: (userId: string, executorId: string) =>
    [...invitationKeys.all(userId), 'options', executorId] as const,
};

export function receivedInvitationsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: invitationKeys.received(userId),
    queryFn: ({ pageParam }) =>
      invitationsApi.getReceived(pageParam, WORKSPACE_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function listingInvitationQuery(userId: string, listingId: string) {
  return queryOptions({
    queryKey: invitationKeys.forListing(userId, listingId),
    queryFn: () => invitationsApi.getForListing(listingId),
    select: (page) => page.items[0] ?? null,
  });
}

// Loaded each time the dialog opens: the jobs and their states change in
// other tabs too.
export function invitationOptionsQuery(userId: string, executorId: string) {
  return queryOptions({
    queryKey: invitationKeys.options(userId, executorId),
    queryFn: () => invitationsApi.getOptions(executorId),
    staleTime: 0,
  });
}
