"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

  const isOwner = user?.id === clientId;
  const applied = hasApplied(listingId);

  const performDelete = async () => {
    if (!token) return;
    setIsDeleting(true);
    try {
      await listingsApi.delete(listingId, token);
      toast.success("Oglas je obrisan.");
      router.push("/");
    } catch (err) {
      toast.error((err as Error).message);
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    toast("Obrisati ovaj oglas?", {
      description: "Ova radnja se ne može poništiti.",
      action: { label: "Obriši", onClick: performDelete },
      cancel: { label: "Otkaži", onClick: () => {} },
    });
  };

  if (isOwner) {
    return (
      <button
        className="rounded-md border border-red-600 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        disabled={isDeleting}
        onClick={handleDelete}
      >
        {isDeleting ? "Brišem..." : "Obriši oglas"}
      </button>
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
          else toast.info("Chat dolazi uskoro 💬");
        }}
      >
        Pošalji poruku
      </button>
    </div>
  );
}
