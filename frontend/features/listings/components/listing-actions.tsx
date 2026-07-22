"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";
import { useApplicationsStore } from "@/features/applications/store";
import { listingsApi } from "@/features/listings/api";

type ListingActionsProps = {
  listingId: string;
  clientId: string;
};

export function ListingActions({ listingId, clientId }: ListingActionsProps) {
  const router = useRouter();
  const { user, token, openAuthModal } = useAuthStore();
  const { openApply, hasApplied } = useApplicationsStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.id === clientId;
  const applied = hasApplied(listingId);

  const handleDelete = async () => {
    if (!token) return;
    if (!confirm("Sigurno želiš obrisati ovaj oglas? Ova radnja se ne može poništiti.")) return;

    setIsDeleting(true);
    setError(null);
    try {
      await listingsApi.delete(listingId, token);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
      setIsDeleting(false);
    }
  };

  if (isOwner) {
    return (
      <div className="space-y-2">
        <button
          className="rounded-md border border-red-600 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? "Brišem..." : "Obriši oglas"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

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
