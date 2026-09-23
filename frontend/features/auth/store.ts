import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useApplicationsStore } from '@/features/applications/store';
import {
  ApiError,
  authApi,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
} from './api';

// Only a genuine 401 means the token is actually invalid. Anything else
// (rate limiting, a network blip, a 5xx) is transient and must not wipe
// an otherwise-valid session.
function isUnauthorized(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

function authErrorMessage(err: unknown) {
  if (err instanceof ApiError && err.status === 429) {
    return 'Previše pokušaja. Sačekaj malo pa pokušaj ponovo.';
  }
  return (err as Error).message;
}

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register' | 'verify';
  verificationEmail: string | null;

  openAuthModal: () => void;
  openRegistrationModal: () => void;
  closeAuthModal: () => void;
  clearError: () => void;
  setAuthModalTab: (tab: 'login' | 'register') => void;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  verifyEmail: (code: string) => Promise<boolean>;
  resendVerification: () => Promise<boolean>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
};

function clearSession(set: (partial: Partial<AuthState>) => void) {
  useApplicationsStore.getState().reset();
  set({ user: null, token: null, refreshToken: null });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,
      isAuthModalOpen: false,
      authModalTab: 'login',
      verificationEmail: null,

      openAuthModal: () =>
        set({
          isAuthModalOpen: true,
          authModalTab: 'login',
          verificationEmail: null,
          error: null,
        }),
      openRegistrationModal: () =>
        set({
          isAuthModalOpen: true,
          authModalTab: 'register',
          verificationEmail: null,
          error: null,
        }),
      closeAuthModal: () =>
        set({
          isAuthModalOpen: false,
          authModalTab: 'login',
          verificationEmail: null,
          error: null,
        }),
      clearError: () => set({ error: null }),
      setAuthModalTab: (authModalTab) => set({ authModalTab, error: null }),

      login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { user, accessToken, refreshToken } =
            await authApi.login(payload);
          set({
            user,
            token: accessToken,
            refreshToken,
            isLoading: false,
            isAuthModalOpen: false,
          });
        } catch (err) {
          if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
            set({
              authModalTab: 'verify',
              verificationEmail: payload.email.trim().toLowerCase(),
              error: null,
              isLoading: false,
            });
            return;
          }
          set({ error: authErrorMessage(err), isLoading: false });
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(payload);
          set({
            authModalTab: 'verify',
            verificationEmail: response.email,
            isLoading: false,
          });
        } catch (err) {
          if (
            err instanceof ApiError &&
            err.code === 'EMAIL_VERIFICATION_PENDING'
          ) {
            set({
              authModalTab: 'verify',
              verificationEmail: payload.email.trim().toLowerCase(),
              error: null,
              isLoading: false,
            });
            return;
          }
          set({ error: authErrorMessage(err), isLoading: false });
        }
      },

      verifyEmail: async (code) => {
        const email = get().verificationEmail;
        if (!email) return false;

        set({ isLoading: true, error: null });
        try {
          const { user, accessToken, refreshToken } = await authApi.verifyEmail(
            email,
            code,
          );
          set({
            user,
            token: accessToken,
            refreshToken,
            isLoading: false,
            isAuthModalOpen: false,
            authModalTab: 'login',
            verificationEmail: null,
          });
          return true;
        } catch (err) {
          set({ error: authErrorMessage(err), isLoading: false });
          return false;
        }
      },

      resendVerification: async () => {
        const email = get().verificationEmail;
        if (!email) return false;

        set({ isLoading: true, error: null });
        try {
          await authApi.resendVerification(email);
          set({ isLoading: false });
          return true;
        } catch (err) {
          set({ error: authErrorMessage(err), isLoading: false });
          return false;
        }
      },

      logout: () => {
        const token = get().token;
        if (token) {
          // best-effort: invalidate the refresh token server-side, don't block the UI on it
          authApi.logout(token).catch(() => {});
        }
        clearSession(set);
      },

      restoreSession: async () => {
        const { token, refreshToken } = get();
        if (!token) return;

        try {
          const user = await authApi.me(token);
          set({ user });
          return;
        } catch (err) {
          if (!isUnauthorized(err)) return; // transient failure — keep the session, try again later
          // access token has genuinely expired — fall through to a refresh attempt
        }

        if (refreshToken) {
          try {
            await get().refreshAccessToken();
            const user = await authApi.me(get().token!);
            set({ user });
            return;
          } catch (err) {
            if (!isUnauthorized(err)) return; // transient failure — keep the session, try again later
            // refresh token is also genuinely invalid/expired
          }
        }

        clearSession(set);
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { accessToken, refreshToken: newRefreshToken } =
          await authApi.refresh(refreshToken);
        set({ token: accessToken, refreshToken: newRefreshToken });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
