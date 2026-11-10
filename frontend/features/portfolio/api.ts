import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
export type PortfolioPhoto = components['schemas']['PortfolioPhotoDto'];

// The backend's limits, checked here first.
export const MAX_PORTFOLIO_PHOTOS = 8;
export const MAX_CAPTION_LENGTH = 120;

// The gallery itself comes with the public profile, in GET /users/{id}.
export const portfolioApi = {
  add: (file: File) => {
    const body = new FormData();
    body.append('photo', file);
    return authRequest<PortfolioPhoto>('/auth/me/portfolio', {
      method: 'POST',
      body,
    });
  },

  updateCaption: (photoId: string, caption: string) =>
    authRequest<PortfolioPhoto>(
      `/auth/me/portfolio/${encodeURIComponent(photoId)}`,
      { method: 'PATCH', body: JSON.stringify({ caption }) },
    ),

  remove: (photoId: string) =>
    authRequest<null>(`/auth/me/portfolio/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    }),
};
