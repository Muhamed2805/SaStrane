"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store";
import { listingsApi } from "@/features/listings/api";
import { useApplicationsStore } from "../store";

export function ApplyModal() {
  const { token } = useAuthStore();
  const {
    isApplyOpen,
    activeListingId,
    closeApply,
    submitApplication,
    hasApplied,
    isSubmitting,
    error,
  } = useApplicationsStore();

  const [listingTitle, setListingTitle] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!activeListingId) {
      setListingTitle(null);
      return;
    }

    listingsApi
      .getById(activeListingId)
      .then((listing) => setListingTitle(listing.title))
      .catch(() => setListingTitle(null));
  }, [activeListingId]);

  const alreadyApplied = useMemo(() => {
    if (!activeListingId) return false;
    return hasApplied(activeListingId);
  }, [activeListingId, hasApplied]);

  if (!isApplyOpen || !activeListingId) return null;

  const handleSubmit = async () => {
    if (!token) return;
    await submitApplication(activeListingId, message, price, token);
    if (!useApplicationsStore.getState().error) {
      toast.success("Prijava je poslana!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={closeApply} />

      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-lg">
        <div className="mb-4">
          <div className="text-lg font-semibold">Prijava na oglas</div>
          <div className="text-sm text-muted-foreground">
            {listingTitle ?? `Oglas #${activeListingId}`}
          </div>
        </div>

        {alreadyApplied ? (
          <div className="rounded-md border p-3 text-sm">
            Već si prijavljen na ovaj oglas ✅
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              className="min-h-[110px] w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Napiši kratku poruku (npr. kad si slobodan, iskustvo, koliko ti treba vremena...)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="Predložena cijena (npr. 40 KM ili 20 KM/h) — opcionalno"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              className="h-10 w-full rounded-md bg-black text-sm text-white hover:opacity-90 disabled:opacity-50"
              disabled={isSubmitting || message.trim().length < 10}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Šaljem..." : "Pošalji prijavu"}
            </button>
          </div>
        )}

        <button
          className="mt-3 h-10 w-full rounded-md border text-sm hover:bg-muted"
          onClick={closeApply}
        >
          Zatvori
        </button>
      </div>
    </div>
  );
}
