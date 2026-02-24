"use client";

import { useAuthStore } from "@/features/auth/store";
import { useApplicationsStore } from "@/features/applications/store";

export function ListingActions({ listingId }: { listingId: string }) {
  const { user, openAuthModal } = useAuthStore();
  const { openApply, hasApplied } = useApplicationsStore();

  const applied = hasApplied(listingId);

  return (
    <div className="flex gap-3">
      <button
        className="rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        disabled={applied}
        onClick={() => {
          if (!user) openAuthModal();
          else openApply(listingId);
        }}
      >
        {applied ? "Prijavljen ✅" : "Prijavi se za posao"}
      </button>

      <button
        className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        onClick={() => {
          if (!user) openAuthModal();
          else alert("✅ Chat (uskoro)");
        }}
      >
        Pošalji poruku
      </button>
    </div>
  );
}