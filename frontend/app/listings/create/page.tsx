"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store";
import { listingsApi } from "@/features/listings/api";
import {
  ListingForm,
  ListingFormValues,
} from "@/features/listings/components/listing-form";

export default function CreateListingPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();

  if (!user || !token) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Moraš biti prijavljen da bi objavio oglas.
      </div>
    );
  }

  const handleSubmit = async (values: ListingFormValues) => {
    const listing = await listingsApi.create(
      {
        ...values,
        budget: values.budget || undefined,
        description: values.description || undefined,
      },
      token,
    );
    toast.success("Oglas je uspješno objavljen!");
    router.push(`/listings/${listing.id}`);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novi oglas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Objavi posao koji trebaš obaviti.
        </p>
      </div>

      <ListingForm
        submitLabel="Objavi oglas"
        submittingLabel="Objavljujem..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
