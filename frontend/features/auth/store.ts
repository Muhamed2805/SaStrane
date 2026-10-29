import { create } from 'zustand';
import { useApplicationsStore } from '@/features/applications/store';
import {
  ApiError,
  authApi,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
} from './api';
import { signOut, startSession, subscribeToSession } from './session';

function authErrorMessage(err: unknown) {
  if (err instanceof ApiError && err.status === 429) {
    return 'Previše pokušaja. Sačekaj malo pa pokušaj ponovo.';
  }
  return (err as Error).message;
}

export type AuthModalTab =
  'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'reset-success';

// 'loading' until the app knows whether the browser has a session, so pages
// can wait instead of briefly asking a signed-in user to sign in.
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  isLoading: boolean;
  error: string | null;
  isAuthModalOpen: boolean;
  authModalTab: AuthModalTab;
  verificationEmail: string | null;
  passwordResetEmail: string | null;

  openAuthModal: () => void;
  openRegistrationModal: () => void;
  closeAuthModal: () => void;
  clearError: () => void;
  setAuthModalTab: (tab: AuthModalTab) => void;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  verifyEmail: (code: string) => Promise<boolean>;
  resendVerification: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (code: string, password: string) => Promise<boolean>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  status: 'loading',
  isLoading: false,
  error: null,
  isAuthModalOpen: false,
  authModalTab: 'login',
  verificationEmail: null,
  passwordResetEmail: null,

  openAuthModal: () =>
    set({
      isAuthModalOpen: true,
      authModalTab: 'login',
      verificationEmail: null,
      passwordResetEmail: null,
      error: null,
    }),
  openRegistrationModal: () =>
    set({
      isAuthModalOpen: true,
      authModalTab: 'register',
      verificationEmail: null,
      passwordResetEmail: null,
      error: null,
    }),
  closeAuthModal: () =>
    set({
      isAuthModalOpen: false,
      authModalTab: 'login',
      verificationEmail: null,
      passwordResetEmail: null,
      error: null,
    }),
  clearError: () => set({ error: null }),
  setAuthModalTab: (authModalTab) => set({ authModalTab, error: null }),

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      startSession(await authApi.login(payload));
      set({ isLoading: false, isAuthModalOpen: false });
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
      startSession(await authApi.verifyEmail(email, code));
      set({
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

  requestPasswordReset: async (emailInput) => {
    const email = emailInput.trim().toLowerCase();
    set({ isLoading: true, error: null });
    try {
      await authApi.forgotPassword(email);
      set({
        authModalTab: 'reset',
        passwordResetEmail: email,
        isLoading: false,
      });
      return true;
    } catch (err) {
      set({ error: authErrorMessage(err), isLoading: false });
      return false;
    }
  },

  resetPassword: async (code, password) => {
    const email = get().passwordResetEmail;
    if (!email) return false;

    set({ isLoading: true, error: null });
    try {
      await authApi.resetPassword(email, code, password);
      set({
        authModalTab: 'reset-success',
        passwordResetEmail: null,
        isLoading: false,
      });
      return true;
    } catch (err) {
      set({ error: authErrorMessage(err), isLoading: false });
      return false;
    }
  },

  logout: () => signOut(),
}));

// The session also changes without a store action: when a refresh finds
// the session ended, or another tab signs in or out.
subscribeToSession((user) => {
  if (!user) useApplicationsStore.getState().reset();
  useAuthStore.setState({ user, status: user ? 'signed-in' : 'signed-out' });
});
