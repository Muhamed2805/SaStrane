import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { ListingsFeed } from '@/features/listings/components/listings-feed';
import { listingsQuery } from '@/features/listings/queries';
import {
  feedRequestParams,
  parseListingFilters,
} from '@/features/listings/search-params';
import { getQueryClient } from '@/lib/query-client';
import { listMetadata, listingsSeo } from '@/lib/seo';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Each kind of job and each place has a title, a description and an
// address of its own.
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  return listMetadata(listingsSeo(parseListingFilters(await searchParams)));
}

export default async function ListingsPage({ searchParams }: PageProps) {
  const filters = parseListingFilters(await searchParams);
  // The feed asks for the same query, so the first results come from here.
  // A failed request is left out and the browser tries again.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(listingsQuery(feedRequestParams(filters)));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-primary">Otvoreni poslovi</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Pronađi priliku blizu sebe
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pregledaj lokalne poslove, filtriraj ih prema svojim vještinama i
          pošalji prijavu u nekoliko koraka.
        </p>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ListingsFeed />
      </HydrationBoundary>
    </div>
  );
}
