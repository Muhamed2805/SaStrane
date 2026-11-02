import type { Metadata } from 'next';

export const SITE_NAME = 'SaStrane';

// Links in shared previews need the public address of the site.
export const SITE_URL = new URL(
  process.env.SITE_URL ?? 'http://localhost:3000',
);

// A page that sets its own openGraph replaces the whole object, so it
// spreads these first.
export const BASE_OPEN_GRAPH = {
  siteName: SITE_NAME,
  locale: 'bs_BA',
} satisfies Metadata['openGraph'];

// Pages that show only the signed-in user's data stay out of search results.
export const PRIVATE_PAGE: Metadata['robots'] = { index: false, follow: false };
