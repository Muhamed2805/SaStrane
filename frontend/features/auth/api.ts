import { apiRequest } from "@/lib/api-client";
export { ApiError } from "@/lib/api-client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "CLIENT" | "EXECUTOR" | "BOTH";
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  fullName: string;
  role?: "CLIENT" | "EXECUTOR" | "BOTH";
};

export type LoginPayload = {
  email: string;
  password: string;
};

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: (token: string) =>
    apiRequest<AuthUser>("/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  refresh: (refreshToken: string) =>
    apiRequest<RefreshResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (token: string) =>
    apiRequest<{ success: boolean }>("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
};
