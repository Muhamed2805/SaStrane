import { create } from "zustand";

type User = {
  id: string;
  email: string;
  name: string;
};

type AuthState = {
  user: User | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginMock: (email: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthModalOpen: false,
  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  loginMock: (email: string) =>
    set({
      user: { id: "u1", email, name: "Tarik" },
      isAuthModalOpen: false,
    }),
  logout: () => set({ user: null }),
}));