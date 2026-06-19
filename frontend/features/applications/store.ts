import { create } from 'zustand';
import { applicationsApi } from './api';

type ApplicationsState = {
  isApplyOpen: boolean;
  activeListingId: string | null;
  appliedListingIds: Record<string, true>;
  isSubmitting: boolean;
  error: string | null;

  openApply: (listingId: string) => void;
  closeApply: () => void;
  submitApplication: (listingId: string, message: string, proposedPrice: string, token: string) => Promise<void>;
  syncAppliedIds: (token: string) => Promise<void>;
  hasApplied: (listingId: string) => boolean;
  reset: () => void;
};

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  isApplyOpen: false,
  activeListingId: null,
  appliedListingIds: {},
  isSubmitting: false,
  error: null,

  openApply: (listingId) => set({ isApplyOpen: true, activeListingId: listingId, error: null }),
  closeApply: () => set({ isApplyOpen: false, activeListingId: null, error: null }),

  submitApplication: async (listingId, message, proposedPrice, token) => {
    set({ isSubmitting: true, error: null });
    try {
      await applicationsApi.apply(
        { listingId, message, proposedPrice: proposedPrice || undefined },
        token,
      );
      set((state) => ({
        isApplyOpen: false,
        activeListingId: null,
        isSubmitting: false,
        appliedListingIds: { ...state.appliedListingIds, [listingId]: true },
      }));
    } catch (err) {
      set({ isSubmitting: false, error: (err as Error).message });
    }
  },

  syncAppliedIds: async (token) => {
    try {
      const applications = await applicationsApi.getMyApplications(token);
      const appliedListingIds = applications.reduce<Record<string, true>>((acc, app) => {
        acc[app.listingId] = true;
        return acc;
      }, {});
      set({ appliedListingIds });
    } catch {
      set({ appliedListingIds: {} });
    }
  },

  hasApplied: (listingId) => Boolean(get().appliedListingIds[listingId]),

  reset: () =>
    set({
      isApplyOpen: false,
      activeListingId: null,
      appliedListingIds: {},
      isSubmitting: false,
      error: null,
    }),
}));
