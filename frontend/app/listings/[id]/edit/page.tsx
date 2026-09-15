"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store";
import { listingsApi, ListingFromApi } from "@/features/listings/api";
import {
  ListingForm,
  ListingFormValues,
} from "@/features/listings/components/listing-form";
import { ListingCardSkeleton } from "@/features/listings/components/listing-card-skeleton";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [listing, setListing] = useState<ListingFromApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listingsApi
      .getById(id)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Oglas nije pronađen.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!token) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Moraš biti prijavljen da bi uredio oglas.
      </div>
    );
  }

  if (!user || (!listing && !loadError)) {
    return <ListingCardSkeleton />;
  }

  if (loadError || !listing) {
    return (
      <div className="rounded-lg border p-4 text-sm" role="alert">
        {loadError ?? "Oglas nije pronađen."}
      </div>
    );
  }

  if (listing.client.id !== user.id) {
    return (
      <div className="rounded-lg border p-4 text-sm" role="alert">
        Samo vlasnik može uređivati ovaj oglas.
      </div>
    );
  }

  const handleSubmit = async (values: ListingFormValues) => {
    await listingsApi.update(
      id,
      {
        ...values,
        budget: values.budget || null,
        description: values.description || null,
      },
      token,
    );
    toast.success("Oglas je uspješno ažuriran!");
    router.push(`/listings/${id}`);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Uredi oglas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ažuriraj informacije o poslu.
        </p>
      </div>

      <ListingForm
        initialValues={{
          title: listing.title,
          category: listing.category,
          location: listing.location,
          budget: listing.budget ?? "",
          description: listing.description ?? "",
        }}
        submitLabel="Sačuvaj izmjene"
        submittingLabel="Čuvam..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
