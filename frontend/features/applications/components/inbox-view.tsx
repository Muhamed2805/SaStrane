'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useInfiniteQuery,
  type InfiniteQueryObserverResult,
} from '@tanstack/react-query';
import {
  Bookmark,
  BriefcaseBusiness,
  ClipboardList,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { ListingCard } from '@/features/listings/components/listing-card';
import { MyListingCard } from '@/features/listings/components/my-listing-card';
import { ownedListingsQuery } from '@/features/listings/queries';
import { savedListingsQuery } from '@/features/saved-listings/queries';
import { pageItems, pageTotal } from '@/lib/paging';
import { useDecideApplication } from '../hooks';
import { receivedApplicationsQuery, sentApplicationsQuery } from '../queries';
import { ApplicationCardSkeleton } from './application-card-skeleton';
import { MyApplicationCard } from './my-application-card';
import { ReceivedApplicationCard } from './received-application-card';

export type InboxTab = 'listings' | 'applications' | 'received' | 'saved';

// A failed next page keeps the loaded pages, so it shows as a toast.
async function loadMore(
  fetchNextPage: () => Promise<InfiniteQueryObserverResult<unknown, Error>>,
) {
  const result = await fetchNextPage();
  if (result.isFetchNextPageError) toast.error(result.error.message);
}

function LoadMoreButton({
  isLoading,
  onClick,
}: {
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold text-muted-foreground hover:border-primary/30 hover:text-primary disabled:opacity-50"
    >
      {isLoading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      {isLoading ? 'Učitavam...' : 'Učitaj još'}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

export function InboxView({
  initialTab = 'applications',
}: {
  initialTab?: InboxTab;
}) {
  const { user, status: authStatus, openAuthModal } = useAuthStore();
  const [activeTab, setActiveTab] = useState<InboxTab>(initialTab);

  const userId = user?.id ?? '';
  const enabled = Boolean(user);
  const ownedListings = useInfiniteQuery({
    ...ownedListingsQuery(userId),
    enabled,
  });
  const sentApplications = useInfiniteQuery({
    ...sentApplicationsQuery(userId),
    enabled,
  });
  const receivedApplications = useInfiniteQuery({
    ...receivedApplicationsQuery(userId),
    enabled,
  });
  const savedListings = useInfiniteQuery({
    ...savedListingsQuery(userId),
    enabled,
  });
  const { decide, updatingId } = useDecideApplication(userId);

  const queries = {
    listings: ownedListings,
    applications: sentApplications,
    received: receivedApplications,
    saved: savedListings,
  };
  const activeQuery = queries[activeTab];
  // A failed first page shows an error. A failed later page shows a toast.
  const error = activeQuery.data ? null : activeQuery.error?.message;
  const isLoading = activeQuery.isPending && !error;

  const myListings = pageItems(ownedListings.data?.pages);
  const myApplications = pageItems(sentApplications.data?.pages);
  const received = pageItems(receivedApplications.data?.pages);
  const saved = pageItems(savedListings.data?.pages);

  // The tab is page state only, so the URL changes without a new render on
  // the server.
  const selectTab = (tab: InboxTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `?tab=${tab}`);
  };

  if (authStatus === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <ApplicationCardSkeleton />
        <ApplicationCardSkeleton />
        <ApplicationCardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">Prijavi se za nastavak</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Tvoji oglasi i prijave dostupni su nakon prijave na SaStrane račun.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          onClick={openAuthModal}
        >
          Prijavi se
        </button>
      </div>
    );
  }

  const tabs: Array<{
    id: InboxTab;
    label: string;
    count: number | undefined;
    icon: typeof Inbox;
  }> = [
    {
      id: 'listings',
      label: 'Moji oglasi',
      count: pageTotal(ownedListings.data?.pages),
      icon: ClipboardList,
    },
    {
      id: 'applications',
      label: 'Moje prijave',
      count: pageTotal(sentApplications.data?.pages),
      icon: Send,
    },
    {
      id: 'received',
      label: 'Primljene prijave',
      count: pageTotal(receivedApplications.data?.pages),
      icon: Inbox,
    },
    {
      id: 'saved',
      label: 'Sačuvano',
      count: pageTotal(savedListings.data?.pages),
      icon: Bookmark,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Tvoja aktivnost</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Moj radni prostor
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Upravljaj oglasima, prijavama, pristiglim ponudama i sačuvanim
            poslovima.
          </p>
        </div>
        <Link
          href="/listings/create"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-dark"
        >
          <Plus className="size-4" aria-hidden="true" />
          Objavi novi oglas
        </Link>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Sažetak aktivnosti"
      >
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`rounded-xl border p-5 text-left transition-all ${
              activeTab === id
                ? 'border-primary bg-primary/[0.06] shadow-sm'
                : 'bg-white hover:border-primary/30'
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span
                className={`flex size-10 items-center justify-center rounded-xl ${
                  activeTab === id
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-2xl font-bold">{count ?? '—'}</span>
            </span>
            <span className="mt-4 block text-sm font-semibold">{label}</span>
          </button>
        ))}
      </section>

      <div className="overflow-x-auto border-b">
        <div className="flex min-w-max gap-7" role="tablist">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => selectTab(id)}
              className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                {count ?? '—'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Podaci nisu učitani</p>
          <p className="mt-1 text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void activeQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 font-semibold underline"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Pokušaj ponovo
          </button>
        </div>
      ) : null}

      {isLoading && !error ? (
        <div className="space-y-4">
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
        </div>
      ) : null}

      {!isLoading && !error && activeTab === 'listings' ? (
        <section className="space-y-4" aria-label="Moji oglasi">
          {myListings.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Još nemaš objavljenih oglasa"
              description="Objavi prvi posao i počni primati ponude lokalnih izvođača."
              actionHref="/listings/create"
              actionLabel="Objavi prvi oglas"
            />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {myListings.map((listing) => (
                  <MyListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {ownedListings.hasNextPage ? (
                <LoadMoreButton
                  isLoading={ownedListings.isFetchingNextPage}
                  onClick={() => void loadMore(ownedListings.fetchNextPage)}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {!isLoading && !error && activeTab === 'applications' ? (
        <section className="space-y-4" aria-label="Moje prijave">
          {myApplications.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="Još nema poslanih prijava"
              description="Pregledaj dostupne poslove i pronađi priliku koja odgovara tvojim vještinama."
              actionHref="/listings"
              actionLabel="Pregledaj oglase"
            />
          ) : (
            <>
              <div className="space-y-4">
                {myApplications.map((application) => (
                  <MyApplicationCard
                    key={application.id}
                    application={application}
                  />
                ))}
              </div>
              {sentApplications.hasNextPage ? (
                <LoadMoreButton
                  isLoading={sentApplications.isFetchingNextPage}
                  onClick={() => void loadMore(sentApplications.fetchNextPage)}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {!isLoading && !error && activeTab === 'received' ? (
        <section className="space-y-4" aria-label="Primljene prijave">
          {received.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Još nema primljenih prijava"
              description="Kada se izvođači prijave na tvoje oglase, njihove ponude pojavit će se ovdje."
              actionHref="/listings/create"
              actionLabel="Objavi novi oglas"
            />
          ) : (
            <>
              <div className="space-y-4">
                {received.map((application) => (
                  <ReceivedApplicationCard
                    key={application.id}
                    application={application}
                    listing={application.listing}
                    isUpdating={updatingId === application.id}
                    onStatusUpdate={decide}
                  />
                ))}
              </div>
              {receivedApplications.hasNextPage ? (
                <LoadMoreButton
                  isLoading={receivedApplications.isFetchingNextPage}
                  onClick={() =>
                    void loadMore(receivedApplications.fetchNextPage)
                  }
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {!isLoading && !error && activeTab === 'saved' ? (
        <section className="space-y-4" aria-label="Sačuvani oglasi">
          {saved.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Još nemaš sačuvanih oglasa"
              description="Sačuvaj oglase koji te zanimaju, pa ih ovdje lako pronađi kasnije."
              actionHref="/listings"
              actionLabel="Pregledaj oglase"
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {saved.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {savedListings.hasNextPage ? (
                <LoadMoreButton
                  isLoading={savedListings.isFetchingNextPage}
                  onClick={() => void loadMore(savedListings.fetchNextPage)}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
