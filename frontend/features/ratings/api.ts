import { authRequest } from '@/features/auth/session';
import { apiRequest } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type Rating = Schemas['RatingDto'];
export type RatingsPage = Schemas['RatingsPageDto'];
export type RatingSummary = Schemas['RatingSummaryDto'];
export type UserProfile = Schemas['UserProfileDto'];
export type CreateRatingPayload = Schemas['CreateRatingDto'];

export const MAX_SCORE = 5;
export const MAX_COMMENT_LENGTH = 1000;

export const ratingsApi = {
  create: (payload: CreateRatingPayload) =>
    authRequest<Rating>('/ratings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Public: profiles need no sign-in.
  getProfile: (userId: string, signal?: AbortSignal) =>
    apiRequest<UserProfile>(`/users/${encodeURIComponent(userId)}`, {
      cache: 'no-store',
      signal,
    }),

  getRatings: (userId: string, page: number, limit: number) =>
    apiRequest<RatingsPage>(
      `/users/${encodeURIComponent(userId)}/ratings?page=${page}&limit=${limit}`,
      { cache: 'no-store' },
    ),
};
