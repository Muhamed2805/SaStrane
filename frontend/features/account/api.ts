import type { AuthUser } from '@/features/auth/api';
import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type UpdateProfilePayload = Schemas['UpdateProfileDto'];
export type ChangePasswordPayload = Schemas['ChangePasswordDto'];

export const accountApi = {
  updateProfile: (payload: UpdateProfilePayload) =>
    authRequest<AuthUser>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: ChangePasswordPayload) =>
    authRequest<null>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setAvatar: (file: File) => {
    const body = new FormData();
    body.append('photo', file);
    return authRequest<AuthUser>('/auth/me/avatar', { method: 'PUT', body });
  },

  removeAvatar: () =>
    authRequest<AuthUser>('/auth/me/avatar', { method: 'DELETE' }),

  deleteAccount: (password: string) =>
    authRequest<null>('/auth/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
};
