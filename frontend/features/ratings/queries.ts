import {
  infiniteQueryOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import { applicationKeys } from '@/features/applications/queries';
import { executorKeys } from '@/features/executors/queries';
import { nextPageParam } from '@/lib/paging';
import { ratingsApi } from './api';

export const RATINGS_PAGE_SIZE = 10;

// Profiles are public, so their keys are not scoped to the signed-in user.
export const profileKeys = {
  all: ['users'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
  ratings: (userId: string) =>
    [...profileKeys.detail(userId), 'ratings'] as const,
};

export function userProfileQuery(userId: string) {
  return queryOptions({
    queryKey: profileKeys.detail(userId),
    queryFn: ({ signal }) => ratingsApi.getProfile(userId, signal),
  });
}

export function userRatingsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: profileKeys.ratings(userId),
    queryFn: ({ pageParam }) =>
      ratingsApi.getRatings(userId, pageParam, RATINGS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

// After the client rates an executor: the application lists show the
// rating, and the executor's profile and place in the list change.
export function ratingGiven(
  queryClient: QueryClient,
  userId: string,
  executorId: string,
) {
  void queryClient.invalidateQueries({ queryKey: applicationKeys.all(userId) });
  void queryClient.invalidateQueries({
    queryKey: profileKeys.detail(executorId),
  });
  void queryClient.invalidateQueries({ queryKey: executorKeys.all });
}
