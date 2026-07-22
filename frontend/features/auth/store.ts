import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useApplicationsStore } from '@/features/applications/store';
import { ApiError, authApi, type AuthUser, type LoginPayload, type RegisterPayload } from './api';

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

  openAuthModal: () => void;
  closeAuthModal: () => void;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
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

      openAuthModal: () => set({ isAuthModalOpen: true, error: null }),
      closeAuthModal: () => set({ isAuthModalOpen: false, error: null }),

      login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { user, accessToken, refreshToken } = await authApi.login(payload);
          set({ user, token: accessToken, refreshToken, isLoading: false, isAuthModalOpen: false });
        } catch (err) {
          set({ error: authErrorMessage(err), isLoading: false });
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { user, accessToken, refreshToken } = await authApi.register(payload);
          set({ user, token: accessToken, refreshToken, isLoading: false, isAuthModalOpen: false });
        } catch (err) {
          set({ error: authErrorMessage(err), isLoading: false });
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

        const { accessToken, refreshToken: newRefreshToken } = await authApi.refresh(refreshToken);
        set({ token: accessToken, refreshToken: newRefreshToken });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken }),
    }
  )
);
