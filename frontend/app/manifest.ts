import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/site';

// Lets a phone add the site to its home screen under its name and colors.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} – lokalni poslovi u tvojoj blizini`,
    short_name: SITE_NAME,
    description:
      'Objavi posao ili zaradi sa strane: košenje trave, selidbe, čišćenje i drugi lokalni poslovi po Bosni i Hercegovini.',
    lang: 'bs',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f9f91',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
