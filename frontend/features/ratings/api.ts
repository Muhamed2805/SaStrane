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
export type ClientRating = Schemas['ClientRatingDto'];
export type ClientRatingsPage = Schemas['ClientRatingsPageDto'];
export type CreateClientRatingPayload = Schemas['CreateClientRatingDto'];

export const MAX_SCORE = 5;
export const MAX_COMMENT_LENGTH = 1000;

export const ratingsApi = {
  create: (payload: CreateRatingPayload) =>
    authRequest<Rating>('/ratings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createForClient: (payload: CreateClientRatingPayload) =>
    authRequest<ClientRating>('/client-ratings', {
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

  getClientRatings: (userId: string, page: number, limit: number) =>
    apiRequest<ClientRatingsPage>(
      `/users/${encodeURIComponent(userId)}/client-ratings?page=${page}&limit=${limit}`,
      { cache: 'no-store' },
    ),
};
