'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
  CATEGORY_LABELS,
  isListingCategory,
  isListingLocation,
  LISTING_CATEGORIES,
  LISTING_LOCATIONS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { listingsQuery } from '../queries';
import {
  feedRequestParams,
  listingFiltersQuery,
  parseListingFilters,
  type ListingFilters,
} from '../search-params';
import { ListingCard } from './listing-card';
import { ListingCardSkeleton } from './listing-card-skeleton';

// The select value that turns a filter off.
const ALL_FILTER = '';

const SEARCH_DEBOUNCE_MS = 300;

function getVisiblePages(page: number, totalPages: number) {
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const count = Math.min(5, totalPages);
  return Array.from({ length: count }, (_, index) => firstPage + index);
}

function resultsLabel(total: number) {
  if (total === 1) return 'Pronađen 1 oglas';
  return `Pronađeno ${total} oglasa`;
}

// Writes the filters to the URL without a new render on the server. Typing
// replaces the history entry, so Back skips the single keystrokes.
function showFilters(filters: ListingFilters, mode: 'push' | 'replace') {
  const query = listingFiltersQuery(filters);
  const url = query ? `?${query}` : window.location.pathname;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

// The URL holds the search, filters and page. The server page renders the
// first results for the same URL, so they show without a loading state.
export function ListingsFeed() {
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseListingFilters(searchParams),
    [searchParams],
  );
  const { q, category, location, page } = filters;

  // The search box updates the URL after a short pause in typing.
  const [searchText, setSearchText] = useState(q);
  const [urlQuery, setUrlQuery] = useState(q);
  if (q !== urlQuery) {
    // Back or Forward changed the search: show it in the box. A search the
    // box itself sent keeps the text as typed, spaces included.
    setUrlQuery(q);
    if (q !== searchText.trim()) setSearchText(q);
  }
  const isTyping = searchText.trim() !== q;

  useEffect(() => {
    const nextQuery = searchText.trim();
    if (nextQuery === q) return;

    const timeout = window.setTimeout(
      () => showFilters({ ...filters, q: nextQuery, page: 1 }, 'replace'),
      nextQuery ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [filters, q, searchText]);

  const { data, error, isPending, isPlaceholderData } = useQuery({
    ...listingsQuery(feedRequestParams(filters)),
    // The old results stay on screen, dimmed, while the new ones load.
    placeholderData: keepPreviousData,
  });

  const listings = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const isLoading = isPending && !error;
  const isRefreshing = isPlaceholderData || isTyping;
  const hasActiveFilters =
    Boolean(searchText.trim()) || Boolean(category) || Boolean(location);
  const visiblePages = useMemo(
    () => getVisiblePages(page, totalPages),
    [page, totalPages],
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    showFilters(
      {
        ...filters,
        category: isListingCategory(value) ? value : undefined,
        page: 1,
      },
      'push',
    );
  };

  const handleLocationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    showFilters(
      {
        ...filters,
        location: isListingLocation(value) ? value : undefined,
        page: 1,
      },
      'push',
    );
  };

  const clearFilters = () => {
    setSearchText('');
    showFilters({ q: '', page: 1 }, 'push');
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
    showFilters({ ...filters, page: nextPage }, 'push');
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
            value={searchText}
            onChange={handleSearchChange}
          />
          {searchText ? (
            <button
              type="button"
              onClick={() => setSearchText('')}
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
              value={category ?? ALL_FILTER}
              onChange={handleCategoryChange}
            >
              <option value={ALL_FILTER}>Sve kategorije</option>
              {LISTING_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {CATEGORY_LABELS[item]}
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
              value={location ?? ALL_FILTER}
              onChange={handleLocationChange}
            >
              <option value={ALL_FILTER}>Sve lokacije</option>
              {LISTING_LOCATIONS.map((item) => (
                <option key={item} value={item}>
                  {LOCATION_LABELS[item]}
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
          <p className="mt-1 text-red-600">{error.message}</p>
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
