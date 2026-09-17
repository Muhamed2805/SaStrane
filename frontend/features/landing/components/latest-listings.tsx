'use client';

import { useEffect, useState } from 'react';
import { listingsApi, type ListingFromApi } from '@/features/listings/api';
import { ListingCard } from '@/features/listings/components/listing-card';
import { ListingCardSkeleton } from '@/features/listings/components/listing-card-skeleton';

export function LatestListings() {
  const [listings, setListings] = useState<ListingFromApi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    listingsApi
      .getAll({ page: 1, limit: 4 }, controller.signal)
      .then((response) => setListings(response.items))
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return;
        }
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

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
        Još nema objavljenih oglasa. Budi prvi koji će objaviti posao.
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
