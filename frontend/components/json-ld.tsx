import { serializeJsonLd } from '@/lib/seo';

// Structured data for search engines. The browser does not run it: the
// type marks it as data, so it needs no nonce (see proxy.ts).
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
