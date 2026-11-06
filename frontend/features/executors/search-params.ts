import type { ListingCategory, ListingLocation } from '@/features/listings/api';
import {
  isListingCategory,
  isListingLocation,
} from '@/features/listings/constants';
import {
  readSearchParam,
  type SearchParamsRecord,
} from '@/features/listings/search-params';
import type { GetExecutorsParams } from './api';

// Like the job list, the executor list keeps its search, filters and page in
// the URL. The server page and the browser read it with these functions.

export const EXECUTORS_PAGE_SIZE = 12;

export type ExecutorFilters = {
  q: string;
  skill?: ListingCategory;
  location?: ListingLocation;
  page: number;
};

// Values the API would reject turn their filter off.
export function parseExecutorFilters(
  source: URLSearchParams | SearchParamsRecord,
): ExecutorFilters {
  const skill = readSearchParam(source, 'skill');
  const location = readSearchParam(source, 'location');
  const page = Number(readSearchParam(source, 'page'));

  return {
    q: readSearchParam(source, 'q')?.trim() ?? '',
    skill: isListingCategory(skill) ? skill : undefined,
    location: isListingLocation(location) ? location : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// The URL query for the filters, without the defaults.
export function executorFiltersQuery(filters: ExecutorFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.skill) params.set('skill', filters.skill);
  if (filters.location) params.set('location', filters.location);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

export function executorsRequestParams(
  filters: ExecutorFilters,
): GetExecutorsParams {
  return {
    page: filters.page,
    limit: EXECUTORS_PAGE_SIZE,
    q: filters.q || undefined,
    skill: filters.skill,
    location: filters.location,
  };
}

// "Pronađen 1 izvođač", "Pronađena 3 izvođača", "Pronađeno 5 izvođača".
export function executorsFoundLabel(total: number) {
  const lastTwo = total % 100;
  const last = total % 10;
  if (last === 1 && lastTwo !== 11) return `Pronađen ${total} izvođač`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `Pronađena ${total} izvođača`;
  }
  return `Pronađeno ${total} izvođača`;
}
