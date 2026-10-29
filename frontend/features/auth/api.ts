import { apiRequest } from '@/lib/api-client';
export { ApiError } from '@/lib/api-client';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'EXECUTOR' | 'BOTH';
  createdAt: string;
};

// The refresh token never appears here: the server keeps it in an httpOnly
// cookie that page scripts cannot read.
export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export type RegisterResponse = {
  email: string;
  verificationRequired: true;
  expiresInSeconds: number;
};

export type RegisterPayload = {
  email: string;
  password: string;
  fullName: string;
  role: 'CLIENT' | 'EXECUTOR' | 'BOTH';
};

export type LoginPayload = {
  email: string;
  password: string;
};

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
    apiRequest<{ success: true }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    apiRequest<{ success: true }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email: string, code: string, password: string) =>
    apiRequest<{ success: true }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),

  // Both use the refresh cookie, which the browser adds by itself.
  refresh: () => apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' }),

  // keepalive lets the request finish when the page is closing.
  logout: () =>
    apiRequest<null>('/auth/logout', { method: 'POST', keepalive: true }),
};
