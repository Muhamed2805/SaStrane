"use client";

import { useMemo, useState } from "react";
import { useApplicationsStore } from "../store";
import { MOCK_LISTINGS } from "@/features/listings/mock";

export function ApplyModal() {
  const { isApplyOpen, activeListingId, closeApply, submitMock, hasApplied } =
    useApplicationsStore();

  const listing = useMemo(() => {
    if (!activeListingId) return null;
    return MOCK_LISTINGS.find((x) => String(x.id) === String(activeListingId)) ?? null;
  }, [activeListingId]);

  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");

  if (!isApplyOpen || !activeListingId) return null;

  const alreadyApplied = hasApplied(activeListingId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={closeApply} />

      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-lg">
        <div className="mb-4">
          <div className="text-lg font-semibold">Prijava na oglas</div>
          <div className="text-sm text-muted-foreground">
            {listing ? listing.title : `Oglas #${activeListingId}`}
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

            <button
              className="h-10 w-full rounded-md bg-black text-sm text-white hover:opacity-90 disabled:opacity-50"
              disabled={message.trim().length < 10}
              onClick={() => submitMock({ listingId: activeListingId, message, proposedPrice: price })}
            >
              Pošalji prijavu
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