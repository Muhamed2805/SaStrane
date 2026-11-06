import { queryOptions } from '@tanstack/react-query';
import { USER_SCOPE } from '@/lib/query-client';
import { jobAlertsApi } from './api';

// The job alerts belong to the signed-in user.
export const jobAlertKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'job-alerts'] as const,
};

export function jobAlertsQuery(userId: string) {
  return queryOptions({
    queryKey: jobAlertKeys.all(userId),
    queryFn: () => jobAlertsApi.getAll(),
  });
}
