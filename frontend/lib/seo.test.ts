import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  executorsSeo,
  listMetadata,
  listingsSeo,
  serializeJsonLd,
  tabTitle,
} from './seo';

const none = { q: '', page: 1 };

describe('listingsSeo', () => {
  it('describes the whole list', () => {
    expect(listingsSeo(none)).toMatchObject({
      title: 'Oglasi za lokalne poslove',
      canonical: '/listings',
      index: true,
    });
  });

  it('gives each kind of job and each place a page of its own', () => {
    expect(listingsSeo({ ...none, category: 'CLEANING' })).toMatchObject({
      title: 'Čišćenje: oglasi za posao',
      canonical: '/listings?category=CLEANING',
    });
    expect(listingsSeo({ ...none, location: 'SARAJEVO' })).toMatchObject({
      title: 'Poslovi – Sarajevo',
      canonical: '/listings?location=SARAJEVO',
    });
    const both = listingsSeo({
      ...none,
      category: 'MOVING',
      location: 'BANJA_LUKA',
    });
    expect(both.title).toBe('Selidbe – Banja Luka: oglasi');
    expect(both.canonical).toBe(
      '/listings?category=MOVING&location=BANJA_LUKA',
    );
    expect(both.description).toContain('Banja Luka');
  });

  it('keeps the page in the address and the title', () => {
    expect(listingsSeo({ ...none, location: 'TUZLA', page: 3 })).toMatchObject({
      title: 'Poslovi – Tuzla – stranica 3',
      canonical: '/listings?location=TUZLA&page=3',
    });
  });

  it('keeps a text search out of search results', () => {
    const seo = listingsSeo({
      ...none,
      q: 'kosilica',
      category: 'LAWN_MOWING',
    });
    expect(seo.index).toBe(false);
    expect(seo.canonical).toBe('/listings?category=LAWN_MOWING');
    expect(listMetadata(seo).robots).toEqual({ index: false, follow: true });
  });
});

describe('executorsSeo', () => {
  it('names the job and the place', () => {
    expect(executorsSeo(none)).toMatchObject({
      title: 'Izvođači za lokalne poslove',
      canonical: '/executors',
    });
    expect(
      executorsSeo({ ...none, category: 'ASSEMBLY', location: 'MOSTAR' }),
    ).toMatchObject({
      title: 'Montaža – Mostar: izvođači',
      canonical: '/executors?skill=ASSEMBLY&location=MOSTAR',
    });
    expect(executorsSeo({ ...none, location: 'ZENICA' }).title).toBe(
      'Izvođači – Zenica',
    );
  });
});

describe('listMetadata', () => {
  it('repeats the title, description and address for link previews', () => {
    const seo = listingsSeo({ ...none, category: 'DELIVERY' });
    expect(listMetadata(seo)).toMatchObject({
      title: seo.title,
      alternates: { canonical: '/listings?category=DELIVERY' },
      robots: undefined,
      openGraph: {
        title: seo.title,
        description: seo.description,
        url: '/listings?category=DELIVERY',
        siteName: 'SaStrane',
      },
    });
  });
});

describe('tabTitle', () => {
  it('adds the site name', () => {
    expect(tabTitle('Poslovi – Tuzla')).toBe('Poslovi – Tuzla | SaStrane');
  });
});

describe('structured data', () => {
  it('numbers the path to a page with full addresses', () => {
    const data = breadcrumbJsonLd([
      { name: 'Početna', path: '/' },
      { name: 'Oglasi', path: '/listings' },
    ]);
    expect(data.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Početna',
        item: 'http://localhost:3000/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Oglasi',
        item: 'http://localhost:3000/listings',
      },
    ]);
  });

  it('cannot be closed by the text it carries', () => {
    const text = serializeJsonLd({ name: '</script><script>alert(1)' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)' });
  });
});
