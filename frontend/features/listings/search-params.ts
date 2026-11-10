import type {
  GetAllListingsParams,
  ListingCategory,
  ListingLocation,
  ListingSort,
} from './api';
import { isListingCategory, isListingLocation } from './constants';

// The job list keeps its search, filters and page in the URL, so a link or
// a reload shows the same results. The server page and the browser read the
// URL with these functions, so both ask for the same data.

export const FEED_PAGE_SIZE = 9;

// The API takes budgets up to this many KM.
export const MAX_BUDGET_KM = 100_000;

export const LISTING_SORTS = [
  'NEWEST',
  'BUDGET_HIGH',
  'BUDGET_LOW',
] as const satisfies readonly ListingSort[];

export const SORT_LABELS: Record<ListingSort, string> = {
  NEWEST: 'Najnovije',
  BUDGET_HIGH: 'Najveći budžet',
  BUDGET_LOW: 'Najmanji budžet',
};

export type ListingFilters = {
  q: string;
  category?: ListingCategory;
  location?: ListingLocation;
  // In whole KM. Either one leaves out jobs with the price agreed later.
  minBudget?: number;
  maxBudget?: number;
  // Left out for the newest first.
  sort?: Exclude<ListingSort, 'NEWEST'>;
  page: number;
};

// A whole number of KM the API accepts, or nothing.
export function parseBudget(value: string | undefined): number | undefined {
  const text = value?.trim() ?? '';
  if (!/^\d{1,6}$/.test(text)) return undefined;
  const budget = Number(text);
  return budget <= MAX_BUDGET_KM ? budget : undefined;
}

// A minimum above the maximum is read the other way round.
export function budgetRange(minBudget?: number, maxBudget?: number) {
  if (
    minBudget !== undefined &&
    maxBudget !== undefined &&
    minBudget > maxBudget
  ) {
    return { minBudget: maxBudget, maxBudget: minBudget };
  }
  return { minBudget, maxBudget };
}

function isFeedSort(
  value: string | undefined,
): value is Exclude<ListingSort, 'NEWEST'> {
  return value === 'BUDGET_HIGH' || value === 'BUDGET_LOW';
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

// The first value of a query parameter, from the browser or the server page.
export function readSearchParam(
  source: URLSearchParams | SearchParamsRecord,
  key: string,
): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

// Values the API would reject turn their filter off.
export function parseListingFilters(
  source: URLSearchParams | SearchParamsRecord,
): ListingFilters {
  const category = readSearchParam(source, 'category');
  const location = readSearchParam(source, 'location');
  const sort = readSearchParam(source, 'sort');
  const page = Number(readSearchParam(source, 'page'));

  return {
    q: readSearchParam(source, 'q')?.trim() ?? '',
    category: isListingCategory(category) ? category : undefined,
    location: isListingLocation(location) ? location : undefined,
    ...budgetRange(
      parseBudget(readSearchParam(source, 'minBudget')),
      parseBudget(readSearchParam(source, 'maxBudget')),
    ),
    sort: isFeedSort(sort) ? sort : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// The URL query for the filters, without the defaults.
export function listingFiltersQuery(filters: ListingFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.location) params.set('location', filters.location);
  if (filters.minBudget !== undefined) {
    params.set('minBudget', String(filters.minBudget));
  }
  if (filters.maxBudget !== undefined) {
    params.set('maxBudget', String(filters.maxBudget));
  }
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

// The feed shows only jobs that still take applications.
export function feedRequestParams(
  filters: ListingFilters,
): GetAllListingsParams {
  return {
    page: filters.page,
    limit: FEED_PAGE_SIZE,
    status: 'OPEN',
    q: filters.q || undefined,
    category: filters.category,
    location: filters.location,
    minBudget: filters.minBudget,
    maxBudget: filters.maxBudget,
    sort: filters.sort,
  };
}
