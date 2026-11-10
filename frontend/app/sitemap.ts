import type { MetadataRoute } from 'next';
import { executorsApi } from '@/features/executors/api';
import { listingsApi } from '@/features/listings/api';
import {
  LISTING_CATEGORIES,
  LISTING_LOCATIONS,
} from '@/features/listings/constants';
import { absoluteUrl } from '@/lib/seo';

// Built for each request, so a new job is in it at once. The API is not
// there while the site is being built.
export const dynamic = 'force-dynamic';

// The API's largest pages, and how many of them the sitemap asks for: at
// most 2000 jobs and 1000 executors, well under the 50,000 addresses a
// sitemap may hold.
const LISTINGS_PER_PAGE = 100;
const EXECUTORS_PER_PAGE = 50;
const MAX_PAGES = 20;

type Page<T> = { items: T[]; totalPages: number };

// Every page of a list. A failure ends the list early: a shorter sitemap is
// better than none.
async function everyPage<T>(load: (page: number) => Promise<Page<T>>) {
  const items: T[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await load(page);
      items.push(...result.items);
      if (page >= result.totalPages) break;
    }
  } catch {
    // The API is down. What was loaded stays.
  }
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, executors] = await Promise.all([
    everyPage((page) =>
      listingsApi.getAll({ status: 'OPEN', page, limit: LISTINGS_PER_PAGE }),
    ),
    everyPage((page) =>
      executorsApi.getAll({ page, limit: EXECUTORS_PER_PAGE }),
    ),
  ]);

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/listings'), changeFrequency: 'hourly', priority: 0.9 },
    { url: absoluteUrl('/executors'), changeFrequency: 'daily', priority: 0.8 },
    // The list of each kind of job and of each place.
    ...LISTING_CATEGORIES.flatMap((category) => [
      {
        url: absoluteUrl(`/listings?category=${category}`),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
      {
        url: absoluteUrl(`/executors?skill=${category}`),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      },
    ]),
    ...LISTING_LOCATIONS.flatMap((location) => [
      {
        url: absoluteUrl(`/listings?location=${location}`),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
      {
        url: absoluteUrl(`/executors?location=${location}`),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      },
    ]),
    ...listings.map((listing) => ({
      url: absoluteUrl(`/listings/${listing.id}`),
      lastModified: new Date(listing.createdAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...executors.map((executor) => ({
      url: absoluteUrl(`/users/${executor.id}`),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
