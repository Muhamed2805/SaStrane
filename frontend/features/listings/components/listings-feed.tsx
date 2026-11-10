'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Banknote,
  ChevronRight,
  MapPin,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { JobAlertButton } from '@/features/job-alerts/components/job-alert-button';
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
  budgetRange,
  feedRequestParams,
  LISTING_SORTS,
  listingFiltersQuery,
  parseBudget,
  parseListingFilters,
  SORT_LABELS,
  type ListingFilters,
} from '../search-params';
import { ListingCard } from './listing-card';
import { ListingCardSkeleton } from './listing-card-skeleton';

// The select value that turns a filter off.
const ALL_FILTER = '';

const SEARCH_DEBOUNCE_MS = 300;

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
  const { q, category, location, minBudget, maxBudget, sort, page } = filters;
  const hasBudgetFilter = minBudget !== undefined || maxBudget !== undefined;

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
    Boolean(searchText.trim()) ||
    Boolean(category) ||
    Boolean(location) ||
    hasBudgetFilter;

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

  // A budget field applies when it loses focus or on Enter. A value the API
  // would reject clears it.
  const applyBudget = (
    field: 'minBudget' | 'maxBudget',
    event: { currentTarget: HTMLInputElement },
  ) => {
    const input = event.currentTarget;
    const value = parseBudget(input.value);
    if (value === undefined) input.value = '';
    const next = budgetRange(
      field === 'minBudget' ? value : minBudget,
      field === 'maxBudget' ? value : maxBudget,
    );
    if (next.minBudget === minBudget && next.maxBudget === maxBudget) return;
    showFilters({ ...filters, ...next, page: 1 }, 'push');
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    showFilters(
      {
        ...filters,
        sort:
          value === 'BUDGET_HIGH' || value === 'BUDGET_LOW' ? value : undefined,
        page: 1,
      },
      'push',
    );
  };

  // The sort is not a filter, so it stays.
  const clearFilters = () => {
    setSearchText('');
    showFilters({ q: '', sort, page: 1 }, 'push');
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
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

          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Budžet u KM</legend>
            {(
              [
                ['minBudget', minBudget, 'od', 'Najmanji budžet u KM'],
                ['maxBudget', maxBudget, 'do', 'Najveći budžet u KM'],
              ] as const
            ).map(([field, value, prefix, label], index) => (
              <label key={field} className="relative min-w-0 flex-1">
                <span
                  className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs font-semibold text-muted-foreground ${
                    index === 0 ? 'left-4' : 'left-3'
                  }`}
                  aria-hidden="true"
                >
                  {index === 0 ? (
                    <Banknote className="size-4 text-primary" />
                  ) : null}
                  {prefix}
                </span>
                <input
                  // A new value in the URL, from Back or the clear button,
                  // resets the field.
                  key={`${field}-${value ?? ''}`}
                  aria-label={label}
                  inputMode="numeric"
                  defaultValue={value ?? ''}
                  onBlur={(event) => applyBudget(field, event)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyBudget(field, event);
                  }}
                  className={`h-11 w-full rounded-lg border bg-background pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/10 ${
                    index === 0 ? 'pl-[3.75rem]' : 'pl-9'
                  }`}
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  KM
                </span>
              </label>
            ))}
          </fieldset>

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

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-semibold" aria-live="polite">
            {isLoading ? 'Učitavanje oglasa...' : resultsLabel(total)}
          </p>
          {hasBudgetFilter ? (
            <p className="text-xs text-muted-foreground">
              Bez oglasa s cijenom po dogovoru
            </p>
          ) : null}
          {isRefreshing && !isLoading ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Ažuriranje rezultata...
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <JobAlertButton category={category} location={location} />
          <label className="relative">
            <span className="sr-only">Sortiraj oglase</span>
            <ArrowDownUp
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <select
              aria-label="Sortiraj oglase"
              className="h-9 appearance-none rounded-lg border bg-white pr-8 pl-8 text-xs font-semibold outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/10"
              value={sort ?? 'NEWEST'}
              onChange={handleSortChange}
            >
              {LISTING_SORTS.map((item) => (
                <option key={item} value={item}>
                  {SORT_LABELS[item]}
                </option>
              ))}
            </select>
            <ChevronRight
              className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 rotate-90 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
        </div>
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
                Pokušaj promijeniti pojam pretrage, kategoriju, lokaciju ili
                budžet.
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

          <Pagination
            page={page}
            totalPages={totalPages}
            disabled={isRefreshing}
            label="Paginacija oglasa"
            onChange={changePage}
          />
        </>
      ) : null}
    </div>
  );
}
