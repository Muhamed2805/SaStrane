import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

// Search engines read the public pages. The pages of a signed-in user show
// nothing to a visitor, and the API is not a page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/inbox',
        '/messages',
        '/profile',
        '/settings',
        '/login',
        '/listings/create',
        '/listings/*/edit',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
