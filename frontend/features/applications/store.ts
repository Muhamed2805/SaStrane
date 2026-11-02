import { create } from "zustand";

// Which job the apply dialog is open for. The applications themselves are
// server data and live in the query cache (see queries.ts).
type ApplyDialogState = {
  isApplyOpen: boolean;
  activeListingId: string | null;

  openApply: (listingId: string) => void;
  closeApply: () => void;
};

export const useApplicationsStore = create<ApplyDialogState>((set) => ({
  isApplyOpen: false,
  activeListingId: null,

  openApply: (listingId) =>
    set({ isApplyOpen: true, activeListingId: listingId }),
  closeApply: () => set({ isApplyOpen: false, activeListingId: null }),
}));
