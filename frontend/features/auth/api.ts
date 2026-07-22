import { API_URL } from '@/lib/api-url';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'EXECUTOR' | 'BOTH';
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  fullName: string;
  role?: 'CLIENT' | 'EXECUTOR' | 'BOTH';
};

export type LoginPayload = {
  email: string;
  password: string;
};

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message ?? 'Request failed');
  }

  return res.json();
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: (token: string) =>
    request<AuthUser>('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
};