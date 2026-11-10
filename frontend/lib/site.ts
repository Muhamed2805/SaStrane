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
  // The picture of app/opengraph-image.tsx. A page with a photo of its own
  // sets images after spreading this.
  images: [
    {
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: `${SITE_NAME} – lokalni poslovi u tvojoj blizini`,
    },
  ],
} satisfies Metadata['openGraph'];

// Pages that show only the signed-in user's data stay out of search results.
export const PRIVATE_PAGE: Metadata['robots'] = { index: false, follow: false };
