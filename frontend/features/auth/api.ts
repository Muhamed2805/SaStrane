import type { components } from '@/lib/api-schema';
import { apiRequest } from '@/lib/api-client';
export { ApiError } from '@/lib/api-client';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type AuthUser = Schemas['PublicUserDto'];
// The refresh token never appears here: the server keeps it in an httpOnly
// cookie that page scripts cannot read.
export type AuthResponse = Schemas['AuthSessionDto'];
export type RegisterResponse = Schemas['RegistrationDto'];
export type RegisterPayload = Schemas['RegisterDto'];
export type LoginPayload = Schemas['LoginDto'];
type Success = Schemas['SuccessDto'];

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyEmail: (email: string, code: string) =>
    apiRequest<AuthResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  resendVerification: (email: string) =>
    apiRequest<Success>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    apiRequest<Success>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email: string, code: string, password: string) =>
    apiRequest<Success>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),

  // Both use the refresh cookie, which the browser adds by itself.
  refresh: () => apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' }),

  // keepalive lets the request finish when the page is closing.
  logout: () =>
    apiRequest<null>('/auth/logout', { method: 'POST', keepalive: true }),
};
