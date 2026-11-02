import type {
  GetAllListingsParams,
  ListingCategory,
  ListingLocation,
} from './api';
import { isListingCategory, isListingLocation } from './constants';

// The job list keeps its search, filters and page in the URL, so a link or
// a reload shows the same results. The server page and the browser read the
// URL with these functions, so both ask for the same data.

export const FEED_PAGE_SIZE = 9;

export type ListingFilters = {
  q: string;
  category?: ListingCategory;
  location?: ListingLocation;
  page: number;
};

type SearchParamsRecord = Record<string, string | string[] | undefined>;

function read(
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
  const category = read(source, 'category');
  const location = read(source, 'location');
  const page = Number(read(source, 'page'));

  return {
    q: read(source, 'q')?.trim() ?? '',
    category: isListingCategory(category) ? category : undefined,
    location: isListingLocation(location) ? location : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// The URL query for the filters, without the defaults.
export function listingFiltersQuery(filters: ListingFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.location) params.set('location', filters.location);
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
  };
}
