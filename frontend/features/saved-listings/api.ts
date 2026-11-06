import { authRequest } from '@/features/auth/session';
import type { ListingsPage } from '@/features/listings/api';

export const savedListingsApi = {
  // The last saved job comes first.
  getAll: (page: number, limit: number) =>
    authRequest<ListingsPage>(`/saved-listings?page=${page}&limit=${limit}`),

  getIds: () => authRequest<string[]>('/saved-listings/ids'),

  // Answers 204 without a body. Saving twice changes nothing.
  save: (listingId: string) =>
    authRequest<null>(`/saved-listings/${listingId}`, { method: 'PUT' }),

  // Answers 204 without a body.
  unsave: (listingId: string) =>
    authRequest<null>(`/saved-listings/${listingId}`, { method: 'DELETE' }),
};
