import { infiniteQueryOptions } from '@tanstack/react-query';
import { nextPageParam } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import { moderationApi, type ReportStatus } from './api';

// The admin's report lists belong to the signed-in user.
export const moderationKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'reports'] as const,
  list: (userId: string, status: ReportStatus) =>
    [...moderationKeys.all(userId), status] as const,
};

export function reportsQuery(userId: string, status: ReportStatus) {
  return infiniteQueryOptions({
    queryKey: moderationKeys.list(userId, status),
    queryFn: ({ pageParam }) => moderationApi.getReports(status, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}
