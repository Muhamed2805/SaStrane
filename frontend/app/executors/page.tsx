import type { Metadata } from 'next';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ExecutorsFeed } from '@/features/executors/components/executors-feed';
import { executorsQuery } from '@/features/executors/queries';
import {
  executorsRequestParams,
  parseExecutorFilters,
} from '@/features/executors/search-params';
import { getQueryClient } from '@/lib/query-client';

export const metadata: Metadata = {
  title: 'Izvođači',
  description:
    'Ljudi koji rade lokalne poslove po Bosni i Hercegovini, s ocjenama klijenata: selidbe, čišćenje, montaža, IT pomoć i još mnogo toga.',
};

export default async function ExecutorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseExecutorFilters(await searchParams);
  // The feed asks for the same query, so the first results come from here.
  // A failed request is left out and the browser tries again.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    executorsQuery(executorsRequestParams(filters)),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Izvođači</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Pronađi pomoć u svojoj blizini
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Pogledaj ko radi posao kakav ti treba i kako ga ocjenjuju klijenti.
            Objavi oglas, pa izaberi među prijavama.
          </p>
        </div>
        <Link
          href="/listings/create"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-dark"
        >
          <Plus className="size-4" aria-hidden="true" />
          Objavi oglas
        </Link>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ExecutorsFeed />
      </HydrationBoundary>
    </div>
  );
}
