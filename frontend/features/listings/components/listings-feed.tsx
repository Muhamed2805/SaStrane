'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import {
  LISTING_CATEGORIES,
  LISTING_LOCATIONS,
} from '@/features/listings/constants';
import {
  listingsApi,
  type GetAllListingsParams,
  type ListingFromApi,
} from '../api';
import { ListingCard } from './listing-card';
import { ListingCardSkeleton } from './listing-card-skeleton';

const ALL_FILTER = 'Sve';
const CATEGORIES = [ALL_FILTER, ...LISTING_CATEGORIES];
const LOCATIONS = [ALL_FILTER, ...LISTING_LOCATIONS];
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

function createQuery(
  q: string,
  category: string,
  location: string,
  page: number,
): GetAllListingsParams {
  return {
    page,
    limit: PAGE_SIZE,
    q: q.trim() || undefined,
    category: category === ALL_FILTER ? undefined : category,
    location: location === ALL_FILTER ? undefined : location,
  };
}

function appendUnique(current: ListingFromApi[], incoming: ListingFromApi[]) {
  const existingIds = new Set(current.map((listing) => listing.id));
  return [
    ...current,
    ...incoming.filter((listing) => !existingIds.has(listing.id)),
  ];
}

export function ListingsFeed({
  initialQuery = '',
  initialCategory = ALL_FILTER,
  initialLocation = ALL_FILTER,
}: {
  initialQuery?: string;
  initialCategory?: string;
  initialLocation?: string;
}) {
  const [listings, setListings] = useState<ListingFromApi[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);
  const currentFilterKey = `${q.trim()}|${category}|${location}`;
  const [loadedFilterKey, setLoadedFilterKey] = useState(currentFilterKey);
  const filtersPending = currentFilterKey !== loadedFilterKey;

  useEffect(() => {
    const controller = new AbortController();
    const delay = q.trim() ? SEARCH_DEBOUNCE_MS : 0;

    const timeout = window.setTimeout(() => {
      setIsRefreshing(true);
      setError(null);

      listingsApi
        .getAll(createQuery(q, category, location, 1), controller.signal)
        .then((response) => {
          setListings(response.items);
          setPage(response.page);
          setTotalPages(response.totalPages);
          setLoadedFilterKey(currentFilterKey);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(
            err instanceof Error
              ? err.message
              : 'Oglasi trenutno nisu dostupni.',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
            setIsRefreshing(false);
          }
        });
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [q, category, location, currentFilterKey]);

  const loadMore = async () => {
    if (filtersPending || isRefreshing || page >= totalPages) return;

    setIsLoadingMore(true);
    try {
      const response = await listingsApi.getAll(
        createQuery(q, category, location, page + 1),
      );
      setListings((current) => appendUnique(current, response.items));
      setPage(response.page);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oglasi nisu učitani.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQ(event.target.value);
    setIsRefreshing(true);
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setCategory(event.target.value);
    setIsRefreshing(true);
  };

  const handleLocationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocation(event.target.value);
    setIsRefreshing(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          aria-label="Pretraži oglase"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          placeholder="Pretraži (npr. košenje, selidba...)"
          value={q}
          onChange={handleSearchChange}
        />

        <select
          aria-label="Filtriraj po kategoriji"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={category}
          onChange={handleCategoryChange}
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtriraj po lokaciji"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={location}
          onChange={handleLocationChange}
        >
          {LOCATIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {isRefreshing && !isLoading && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Pretražujem oglase...
        </p>
      )}

      {isLoading && (
        <div className="space-y-3">
          <ListingCardSkeleton />
          <ListingCardSkeleton />
          <ListingCardSkeleton />
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          role="alert"
        >
          Greška: {error}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div
            className={`space-y-3 transition-opacity ${
              isRefreshing ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {listings.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Nema oglasa za odabrane filtere.
              </div>
            ) : (
              listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))
            )}
          </div>

          {page < totalPages && (
            <button
              className="h-10 w-full rounded-md border text-sm hover:bg-muted disabled:opacity-50"
              disabled={isLoadingMore || filtersPending || isRefreshing}
              type="button"
              onClick={loadMore}
            >
              {isLoadingMore ? 'Učitavam...' : 'Učitaj još'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
