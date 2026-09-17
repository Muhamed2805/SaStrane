'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
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
const PAGE_SIZE = 9;
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

function getVisiblePages(page: number, totalPages: number) {
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const count = Math.min(5, totalPages);
  return Array.from({ length: count }, (_, index) => firstPage + index);
}

function resultsLabel(total: number) {
  if (total === 1) return 'Pronađen 1 oglas';
  return `Pronađeno ${total} oglasa`;
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
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);
  const hasActiveFilters =
    Boolean(q.trim()) || category !== ALL_FILTER || location !== ALL_FILTER;
  const visiblePages = useMemo(
    () => getVisiblePages(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    const controller = new AbortController();
    const delay = q.trim() ? SEARCH_DEBOUNCE_MS : 0;

    const timeout = window.setTimeout(() => {
      setIsRefreshing(true);
      setError(null);

      listingsApi
        .getAll(createQuery(q, category, location, page), controller.signal)
        .then((response) => {
          setListings(response.items);
          setPage(response.page);
          setTotal(response.total);
          setTotalPages(Math.max(1, response.totalPages));
        })
        .catch((requestError: unknown) => {
          if (
            requestError instanceof DOMException &&
            requestError.name === 'AbortError'
          ) {
            return;
          }
          setError(
            requestError instanceof Error
              ? requestError.message
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
  }, [q, category, location, page]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQ(event.target.value);
    setPage(1);
    setIsRefreshing(true);
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setCategory(event.target.value);
    setPage(1);
    setIsRefreshing(true);
  };

  const handleLocationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocation(event.target.value);
    setPage(1);
    setIsRefreshing(true);
  };

  const clearFilters = () => {
    setQ('');
    setCategory(ALL_FILTER);
    setLocation(ALL_FILTER);
    setPage(1);
    setIsRefreshing(true);
  };

  const changePage = (nextPage: number) => {
    if (
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === page ||
      isRefreshing
    ) {
      return;
    }
    setPage(nextPage);
    setIsRefreshing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-7">
      <section
        className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"
        aria-label="Filteri oglasa"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
          <input
            aria-label="Pretraži oglase"
            className="h-12 w-full rounded-xl border bg-background pr-10 pl-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/10"
            placeholder="Pretraži po nazivu ili opisu posla..."
            value={q}
            onChange={handleSearchChange}
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setPage(1);
              }}
              className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Obriši pretragu"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Kategorija</span>
            <SlidersHorizontal
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <select
              aria-label="Filtriraj po kategoriji"
              className="h-11 w-full appearance-none rounded-lg border bg-background pr-9 pl-11 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/10"
              value={category}
              onChange={handleCategoryChange}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item === ALL_FILTER ? 'Sve kategorije' : item}
                </option>
              ))}
            </select>
            <ChevronRight
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
              aria-hidden="true"
            />
          </label>

          <label className="relative">
            <span className="sr-only">Lokacija</span>
            <MapPin
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <select
              aria-label="Filtriraj po lokaciji"
              className="h-11 w-full appearance-none rounded-lg border bg-background pr-9 pl-11 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/10"
              value={location}
              onChange={handleLocationChange}
            >
              {LOCATIONS.map((item) => (
                <option key={item} value={item}>
                  {item === ALL_FILTER ? 'Sve lokacije' : item}
                </option>
              ))}
            </select>
            <ChevronRight
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
              aria-hidden="true"
            />
          </label>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="size-4" aria-hidden="true" />
            Očisti filtere
          </button>
        </div>
      </section>

      <div className="flex min-h-6 items-center justify-between gap-4">
        <p className="text-sm font-semibold" aria-live="polite">
          {isLoading ? 'Učitavanje oglasa...' : resultsLabel(total)}
        </p>
        {isRefreshing && !isLoading ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Ažuriranje rezultata...
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <ListingCardSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
          role="alert"
        >
          <p className="font-semibold">Oglasi nisu učitani</p>
          <p className="mt-1 text-red-600">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <>
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SearchX className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-lg font-semibold">Nema rezultata</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Pokušaj promijeniti pojam pretrage, kategoriju ili lokaciju.
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Prikaži sve oglase
                </button>
              ) : null}
            </div>
          ) : (
            <div
              className={`grid gap-4 transition-opacity md:grid-cols-2 lg:grid-cols-3 ${
                isRefreshing ? 'pointer-events-none opacity-50' : 'opacity-100'
              }`}
            >
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-center gap-1 pt-3"
              aria-label="Paginacija oglasa"
            >
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page === 1 || isRefreshing}
                className="flex size-10 items-center justify-center rounded-lg border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Prethodna stranica"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>

              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => changePage(pageNumber)}
                  disabled={isRefreshing}
                  className={`size-10 rounded-lg text-sm font-semibold transition-colors ${
                    pageNumber === page
                      ? 'bg-primary text-white'
                      : 'border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary'
                  }`}
                  aria-label={`Stranica ${pageNumber}`}
                  aria-current={pageNumber === page ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page === totalPages || isRefreshing}
                className="flex size-10 items-center justify-center rounded-lg border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Sljedeća stranica"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
