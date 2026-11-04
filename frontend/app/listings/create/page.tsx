'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, ChevronRight, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { listingsApi, type ListingPhoto } from '@/features/listings/api';
import { listingSaved } from '@/features/listings/queries';
import {
  ListingForm,
  type ListingFormResult,
} from '@/features/listings/components/listing-form';
import { NewListingPhotos } from '@/features/listings/components/new-listing-photos';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreateListingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status, openAuthModal } = useAuthStore();
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  if (status === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-[640px] rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">Prijavi se za objavu oglasa</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Za objavu posla potreban je SaStrane račun. Prijava traje samo
          nekoliko trenutaka.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Prijavi se ili registruj
        </button>
      </div>
    );
  }

  const handleSubmit = async (values: ListingFormResult) => {
    const listing = await listingsApi.create({
      ...values,
      budget: values.budget ?? undefined,
      description: values.description || undefined,
    });

    // The job is posted even when a photo fails. The owner can add it again
    // on the edit page.
    const photos: ListingPhoto[] = [];
    let failed = 0;
    for (const file of photoFiles) {
      try {
        photos.push(await listingsApi.addPhoto(listing.id, file));
      } catch {
        failed += 1;
      }
    }

    listingSaved(queryClient, user.id, {
      ...listing,
      photos,
      coverPhoto: photos.at(0) ?? null,
    });
    toast.success('Oglas je uspješno objavljen!');
    if (failed > 0) {
      toast.error(
        failed === 1
          ? 'Jedna slika nije dodana. Dodaj je ponovo u uređivanju oglasa.'
          : `Slike koje nisu dodane: ${failed}. Dodaj ih ponovo u uređivanju oglasa.`,
      );
    }
    setPhotoFiles([]);
    router.push(`/listings/${listing.id}`);
  };

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Početna
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <Link href="/listings" className="hover:text-primary">
          Oglasi
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="text-foreground">Novi oglas</span>
      </nav>

      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BriefcaseBusiness className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">Novi posao</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Objavi oglas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Opiši šta ti je potrebno i poveži se s izvođačima iz svoje blizine.
          </p>
        </div>
      </header>

      <ListingForm
        submitLabel="Objavi oglas"
        submittingLabel="Objavljujem..."
        cancelHref="/listings"
        photos={
          <NewListingPhotos files={photoFiles} onChange={setPhotoFiles} />
        }
        hasOtherChanges={photoFiles.length > 0}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
