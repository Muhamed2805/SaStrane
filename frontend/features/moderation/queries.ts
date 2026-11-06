import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { nextPageParam } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import {
  moderationApi,
  type AdminUserFilter,
  type ListingStatus,
  type ReportStatus,
} from './api';

// The admin pages belong to the signed-in user. Every admin action
// refreshes everything under `all`.
export const adminKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'admin'] as const,
  stats: (userId: string) => [...adminKeys.all(userId), 'stats'] as const,
  reports: (userId: string, status: ReportStatus) =>
    [...adminKeys.all(userId), 'reports', status] as const,
  users: (userId: string, q: string, filter?: AdminUserFilter) =>
    [...adminKeys.all(userId), 'users', q, filter ?? 'ALL'] as const,
  listings: (userId: string, q: string, status?: ListingStatus) =>
    [...adminKeys.all(userId), 'listings', q, status ?? 'ALL'] as const,
};

export function statsQuery(userId: string) {
  return queryOptions({
    queryKey: adminKeys.stats(userId),
    queryFn: moderationApi.getStats,
  });
}

export function reportsQuery(userId: string, status: ReportStatus) {
  return infiniteQueryOptions({
    queryKey: adminKeys.reports(userId, status),
    queryFn: ({ pageParam }) => moderationApi.getReports(status, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function adminUsersQuery(
  userId: string,
  q: string,
  filter?: AdminUserFilter,
) {
  return infiniteQueryOptions({
    queryKey: adminKeys.users(userId, q, filter),
    queryFn: ({ pageParam }) => moderationApi.getUsers(q, filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function adminListingsQuery(
  userId: string,
  q: string,
  status?: ListingStatus,
) {
  return infiniteQueryOptions({
    queryKey: adminKeys.listings(userId, q, status),
    queryFn: ({ pageParam }) => moderationApi.getListings(q, status, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}
