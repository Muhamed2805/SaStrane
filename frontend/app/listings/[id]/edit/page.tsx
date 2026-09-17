'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, LockKeyhole, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { listingsApi, type ListingFromApi } from '@/features/listings/api';
import {
  ListingForm,
  type ListingFormValues,
} from '@/features/listings/components/listing-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, openAuthModal } = useAuthStore();
  const [listing, setListing] = useState<ListingFromApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listingsApi
      .getById(id)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setLoadError(
            requestError instanceof Error
              ? requestError.message
              : 'Oglas nije pronađen.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!token) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">Prijavi se za uređivanje</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Samo vlasnik oglasa može mijenjati njegove podatke.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Prijavi se
        </button>
      </div>
    );
  }

  if (!user || (!listing && !loadError)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Skeleton className="h-[640px] rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError || !listing) {
    return (
      <div
        className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700"
        role="alert"
      >
        {loadError ?? 'Oglas nije pronađen.'}
      </div>
    );
  }

  if (listing.client.id !== user.id) {
    return (
      <div
        className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center shadow-sm"
        role="alert"
      >
        <h1 className="text-lg font-bold">Uređivanje nije dozvoljeno</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Samo vlasnik može uređivati ovaj oglas.
        </p>
        <Link
          href={`/listings/${id}`}
          className="mt-5 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Nazad na oglas
        </Link>
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
    toast.success('Oglas je uspješno ažuriran!');
    router.push(`/listings/${id}`);
    router.refresh();
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
        <Link
          href={`/listings/${id}`}
          className="max-w-48 truncate hover:text-primary"
        >
          {listing.title}
        </Link>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        <span className="shrink-0 text-foreground">Uredi</span>
      </nav>

      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Pencil className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">Tvoj oglas</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Uredi oglas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ažuriraj informacije kako bi izvođači dobili tačne detalje posla.
          </p>
        </div>
      </header>

      <ListingForm
        initialValues={{
          title: listing.title,
          category: listing.category,
          location: listing.location,
          budget: listing.budget ?? '',
          description: listing.description ?? '',
        }}
        submitLabel="Sačuvaj izmjene"
        submittingLabel="Čuvam..."
        cancelHref={`/listings/${id}`}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
