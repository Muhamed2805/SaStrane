import type { Metadata } from 'next';
import type { ListingCategory, ListingLocation } from '@/features/listings/api';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { BASE_OPEN_GRAPH, SITE_NAME, SITE_URL } from '@/lib/site';

// What search engines read about a list page: the job list and the executor
// list, each with a page of its own per kind of job and per place.

export type ListSeoFilters = {
  q: string;
  category?: ListingCategory;
  location?: ListingLocation;
  page: number;
};

type ListSeo = {
  title: string;
  description: string;
  // The address search engines keep: the path with the kind of job, the
  // place and the page. Sorting and the budget show the same jobs.
  canonical: string;
  // A text search has endless variations and none is worth a result.
  index: boolean;
};

const COUNTRY = 'Bosni i Hercegovini';

function canonicalPath(
  path: string,
  categoryParam: string,
  filters: ListSeoFilters,
) {
  const params = new URLSearchParams();
  if (filters.category) params.set(categoryParam, filters.category);
  if (filters.location) params.set('location', filters.location);
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function pageSuffix(page: number) {
  return page > 1 ? ` – stranica ${page}` : '';
}

export function listingsSeo(filters: ListSeoFilters): ListSeo {
  const category = filters.category && CATEGORY_LABELS[filters.category];
  const location = filters.location && LOCATION_LABELS[filters.location];

  let title = 'Oglasi za lokalne poslove';
  let description = `Lokalni poslovi po ${COUNTRY}: košenje trave, selidbe, čišćenje, montaža, dostava i još mnogo toga. Pronađi posao i pošalji prijavu.`;
  if (category && location) {
    title = `${category} – ${location}: oglasi`;
    description = `${category}: otvoreni oglasi za mjesto ${location}. Pogledaj budžet i opis posla i pošalji prijavu na ${SITE_NAME}.`;
  } else if (category) {
    title = `${category}: oglasi za posao`;
    description = `${category}: otvoreni oglasi po ${COUNTRY}. Pogledaj budžet i opis posla i pošalji prijavu na ${SITE_NAME}.`;
  } else if (location) {
    title = `Poslovi – ${location}`;
    description = `Lokalni poslovi za mjesto ${location}: košenje trave, selidbe, čišćenje, montaža i drugo. Pronađi posao i pošalji prijavu na ${SITE_NAME}.`;
  }

  return {
    title: title + pageSuffix(filters.page),
    description,
    canonical: canonicalPath('/listings', 'category', filters),
    index: !filters.q,
  };
}

export function executorsSeo(filters: ListSeoFilters): ListSeo {
  const skill = filters.category && CATEGORY_LABELS[filters.category];
  const location = filters.location && LOCATION_LABELS[filters.location];

  let title = 'Izvođači za lokalne poslove';
  let description = `Ljudi koji rade lokalne poslove po ${COUNTRY}, s ocjenama klijenata: selidbe, čišćenje, montaža, IT pomoć i još mnogo toga.`;
  if (skill && location) {
    title = `${skill} – ${location}: izvođači`;
    description = `${skill}: izvođači za mjesto ${location}, s ocjenama klijenata i slikama radova. Pozovi izvođača na svoj oglas na ${SITE_NAME}.`;
  } else if (skill) {
    title = `${skill}: izvođači`;
    description = `${skill}: izvođači po ${COUNTRY}, s ocjenama klijenata i slikama radova. Pozovi izvođača na svoj oglas na ${SITE_NAME}.`;
  } else if (location) {
    title = `Izvođači – ${location}`;
    description = `Izvođači za mjesto ${location}, s ocjenama klijenata: selidbe, čišćenje, montaža, IT pomoć i drugo. Pozovi ih na svoj oglas na ${SITE_NAME}.`;
  }

  return {
    title: title + pageSuffix(filters.page),
    description,
    canonical: canonicalPath('/executors', 'skill', filters),
    index: !filters.q,
  };
}

export function listMetadata(seo: ListSeo): Metadata {
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    // Links are still followed, so the jobs behind a search are found.
    robots: seo.index ? undefined : { index: false, follow: true },
    openGraph: {
      ...BASE_OPEN_GRAPH,
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
    },
  };
}

// The tab title of a list page, as the title template in app/layout.tsx
// writes it. The filters change without a new page from the server, so the
// list sets the title itself.
export function tabTitle(title: string) {
  return `${title} | ${SITE_NAME}`;
}

// A full address, for structured data and the sitemap.
export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

// The path from the home page to a page, for search results.
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// Structured data sits in a script element. Escaping "<" keeps a job title
// or a name with "</script>" in it from ending that element.
export function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
