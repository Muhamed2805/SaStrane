import { create } from "zustand";

export type ApplicationDraft = {
  listingId: string;
  message: string;
  proposedPrice?: string;
};

type ApplicationsState = {
  isApplyOpen: boolean;
  activeListingId: string | null;
  appliedListingIds: Record<string, true>;

  openApply: (listingId: string) => void;
  closeApply: () => void;

  submitMock: (draft: ApplicationDraft) => void;
  hasApplied: (listingId: string) => boolean;
};

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  isApplyOpen: false,
  activeListingId: null,
  appliedListingIds: {},

  openApply: (listingId) => set({ isApplyOpen: true, activeListingId: listingId }),
  closeApply: () => set({ isApplyOpen: false, activeListingId: null }),

  submitMock: (draft) =>
    set((state) => ({
      isApplyOpen: false,
      activeListingId: null,
      appliedListingIds: { ...state.appliedListingIds, [draft.listingId]: true },
    })),

  hasApplied: (listingId) => Boolean(get().appliedListingIds[listingId]),
}));