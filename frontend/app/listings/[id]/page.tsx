import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Tag,
  UserRound,
} from 'lucide-react';
import { listingsApi } from '@/features/listings/api';
import { ListingActions } from '@/features/listings/components/listing-actions';
import { ListingCard } from '@/features/listings/components/listing-card';
import { ListingApplications } from '@/features/applications/components/listing-applications';
import { formatDate } from '@/lib/format-date';
import { ApiError } from '@/lib/api-client';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailsPage({ params }: PageProps) {
  const { id } = await params;
  let listing;

  try {
    listing = await listingsApi.getById(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const relatedListings = await listingsApi
    .getAll({ category: listing.category, limit: 4 })
    .then((response) =>
      response.items.filter((item) => item.id !== listing.id).slice(0, 3),
    )
    .catch(() => []);

  return (
    <div className="space-y-12">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-primary">
          Početna
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/listings" className="transition-colors hover:text-primary">
          Oglasi
        </Link>
        <span aria-hidden="true">/</span>
        <span className="max-w-56 truncate text-foreground">
          {listing.title}
        </span>
      </nav>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="space-y-6">
          <header className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {listing.category}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                {listing.location}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {listing.title}
            </h1>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t pt-5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Objavljeno {formatDate(listing.createdAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                {listing.client.fullName}
              </span>
            </div>
          </header>

          <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Opis posla</h2>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-muted-foreground">
              {listing.description?.trim() ||
                'Klijent nije naveo dodatni opis ovog posla.'}
            </p>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Detalji oglasa</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/60 p-4">
                <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Tag className="size-4 text-primary" aria-hidden="true" />
                  Kategorija
                </dt>
                <dd className="mt-2 text-sm font-semibold">
                  {listing.category}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  Lokacija
                </dt>
                <dd className="mt-2 text-sm font-semibold">
                  {listing.location}
                </dd>
              </div>
            </dl>
          </section>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <section className="rounded-2xl border bg-white p-6 shadow-lg shadow-slate-900/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Predviđeni budžet
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-orange-dark">
              {listing.budget || 'Po dogovoru'}
            </p>
            <div className="my-6 border-t" />
            <ListingActions
              listingId={listing.id}
              clientId={listing.client.id}
            />
            <div className="mt-5 flex gap-3 rounded-xl bg-primary/[0.06] p-4">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Dogovori sve detalje prije početka posla i ne dijeli osjetljive
                podatke unaprijed.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              O klijentu
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                {listing.client.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {listing.client.fullName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2
                    className="size-3.5 text-primary"
                    aria-hidden="true"
                  />
                  Član SaStrane zajednice
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <ListingApplications
        listingId={listing.id}
        clientId={listing.client.id}
      />

      {relatedListings.length > 0 ? (
        <section aria-labelledby="related-listings-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">Još prilika</p>
              <h2
                id="related-listings-title"
                className="mt-2 text-2xl font-bold tracking-tight"
              >
                Slični oglasi
              </h2>
            </div>
            <Link
              href={`/listings?category=${encodeURIComponent(listing.category)}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Pogledaj sve
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relatedListings.map((relatedListing) => (
              <ListingCard key={relatedListing.id} listing={relatedListing} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
