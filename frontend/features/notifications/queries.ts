import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { POLL_MS, pollEvery } from '@/features/messages/queries';
import { nextPageParam, WORKSPACE_PAGE_SIZE } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import { notificationsApi } from './api';

// Every notification query belongs to the signed-in user.
export const notificationKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'notifications'] as const,
  list: (userId: string) => [...notificationKeys.all(userId), 'list'] as const,
  unreadCount: (userId: string) =>
    [...notificationKeys.all(userId), 'unread-count'] as const,
};

// Loaded again each time the list opens.
export function notificationsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(userId),
    queryFn: ({ pageParam }) =>
      notificationsApi.getAll(pageParam, WORKSPACE_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    staleTime: 0,
  });
}

const toCount = (data: { count: number }) => data.count;

// Asked as often as the unread messages.
export function unreadNotificationsQuery(userId: string) {
  return queryOptions({
    queryKey: notificationKeys.unreadCount(userId),
    queryFn: () => notificationsApi.getUnreadCount(),
    select: toCount,
    refetchInterval: pollEvery(POLL_MS.unreadCount),
  });
}
