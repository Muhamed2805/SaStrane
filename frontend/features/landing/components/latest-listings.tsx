'use client';

import { useQuery } from '@tanstack/react-query';
import { ListingCard } from '@/features/listings/components/listing-card';
import { ListingCardSkeleton } from '@/features/listings/components/listing-card-skeleton';
import { listingsQuery } from '@/features/listings/queries';

export function LatestListings() {
  const { data, isPending, isError } = useQuery(
    listingsQuery({ page: 1, limit: 4, status: 'OPEN' }),
  );
  const listings = data?.items ?? [];
  const isLoading = isPending && !isError;
  const error = isError && !data;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <ListingCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">
        Najnoviji oglasi trenutno nisu dostupni. Pokušaj ponovo uskoro.
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">
        Još nema objavljenih oglasa. Objavi prvi posao na SaStrane.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
