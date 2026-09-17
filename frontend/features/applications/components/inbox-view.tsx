'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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
import { listingsApi, type ListingFromApi } from '@/features/listings/api';
import { MyListingCard } from '@/features/listings/components/my-listing-card';
import { applicationsApi, type ApplicationFromApi } from '../api';
import { ApplicationCardSkeleton } from './application-card-skeleton';
import { MyApplicationCard } from './my-application-card';
import { ReceivedApplicationCard } from './received-application-card';

const PAGE_SIZE = 10;

export type InboxTab = 'listings' | 'applications' | 'received';

function appendUnique<T extends { id: string }>(current: T[], incoming: T[]) {
  const existingIds = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !existingIds.has(item.id))];
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
  const router = useRouter();
  const { user, token, openAuthModal } = useAuthStore();
  const [activeTab, setActiveTab] = useState<InboxTab>(initialTab);
  const [myListings, setMyListings] = useState<ListingFromApi[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationFromApi[]>(
    [],
  );
  const [receivedApplications, setReceivedApplications] = useState<
    ApplicationFromApi[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [myListingsPage, setMyListingsPage] = useState(1);
  const [myListingsTotal, setMyListingsTotal] = useState(0);
  const [myListingsTotalPages, setMyListingsTotalPages] = useState(1);
  const [myPage, setMyPage] = useState(1);
  const [myTotal, setMyTotal] = useState(0);
  const [myTotalPages, setMyTotalPages] = useState(1);
  const [receivedPage, setReceivedPage] = useState(1);
  const [receivedTotal, setReceivedTotal] = useState(0);
  const [receivedTotalPages, setReceivedTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState<InboxTab | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!user || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [listingsPageData, myPageData, receivedPageData] =
        await Promise.all([
          listingsApi.getAll({
            clientId: user.id,
            page: 1,
            limit: PAGE_SIZE,
          }),
          applicationsApi.getMyApplications(token, {
            page: 1,
            limit: PAGE_SIZE,
          }),
          applicationsApi.getReceivedApplications(token, {
            page: 1,
            limit: PAGE_SIZE,
          }),
        ]);

      setMyListings(listingsPageData.items);
      setMyListingsPage(listingsPageData.page);
      setMyListingsTotal(listingsPageData.total);
      setMyListingsTotalPages(Math.max(1, listingsPageData.totalPages));
      setMyApplications(myPageData.items);
      setMyPage(myPageData.page);
      setMyTotal(myPageData.total);
      setMyTotalPages(Math.max(1, myPageData.totalPages));
      setReceivedApplications(receivedPageData.items);
      setReceivedPage(receivedPageData.page);
      setReceivedTotal(receivedPageData.total);
      setReceivedTotalPages(Math.max(1, receivedPageData.totalPages));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Radni prostor trenutno nije dostupan.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    if (user && token) {
      void loadWorkspace();
    } else {
      setIsLoading(false);
    }
  }, [user, token, loadWorkspace]);

  const selectTab = (tab: InboxTab) => {
    setActiveTab(tab);
    router.replace(`/inbox?tab=${tab}`, { scroll: false });
  };

  const loadMoreListings = async () => {
    if (!user || myListingsPage >= myListingsTotalPages) return;
    setLoadingMore('listings');
    try {
      const nextPage = await listingsApi.getAll({
        clientId: user.id,
        page: myListingsPage + 1,
        limit: PAGE_SIZE,
      });
      setMyListings((current) => appendUnique(current, nextPage.items));
      setMyListingsPage(nextPage.page);
      setMyListingsTotalPages(Math.max(1, nextPage.totalPages));
    } catch (requestError) {
      toast.error((requestError as Error).message);
    } finally {
      setLoadingMore(null);
    }
  };

  const loadMoreMyApplications = async () => {
    if (!token || myPage >= myTotalPages) return;
    setLoadingMore('applications');
    try {
      const nextPage = await applicationsApi.getMyApplications(token, {
        page: myPage + 1,
        limit: PAGE_SIZE,
      });
      setMyApplications((current) => appendUnique(current, nextPage.items));
      setMyPage(nextPage.page);
      setMyTotalPages(Math.max(1, nextPage.totalPages));
    } catch (requestError) {
      toast.error((requestError as Error).message);
    } finally {
      setLoadingMore(null);
    }
  };

  const loadMoreReceivedApplications = async () => {
    if (!token || receivedPage >= receivedTotalPages) return;
    setLoadingMore('received');
    try {
      const nextPage = await applicationsApi.getReceivedApplications(token, {
        page: receivedPage + 1,
        limit: PAGE_SIZE,
      });
      setReceivedApplications((current) =>
        appendUnique(current, nextPage.items),
      );
      setReceivedPage(nextPage.page);
      setReceivedTotalPages(Math.max(1, nextPage.totalPages));
    } catch (requestError) {
      toast.error((requestError as Error).message);
    } finally {
      setLoadingMore(null);
    }
  };

  const handleStatusUpdate = async (
    id: string,
    status: 'ACCEPTED' | 'REJECTED',
  ) => {
    if (!token) return;

    setUpdatingId(id);
    try {
      const updated = await applicationsApi.updateStatus(id, { status }, token);
      setReceivedApplications((current) =>
        current.map((application) =>
          application.id === updated.id
            ? { ...application, ...updated }
            : application,
        ),
      );
      toast.success(
        status === 'ACCEPTED'
          ? 'Prijava je prihvaćena.'
          : 'Prijava je odbijena.',
      );
    } catch (requestError) {
      toast.error((requestError as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user || !token) {
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
    count: number;
    icon: typeof Inbox;
  }> = [
    {
      id: 'listings',
      label: 'Moji oglasi',
      count: myListingsTotal,
      icon: ClipboardList,
    },
    {
      id: 'applications',
      label: 'Moje prijave',
      count: myTotal,
      icon: Send,
    },
    {
      id: 'received',
      label: 'Primljene prijave',
      count: receivedTotal,
      icon: Inbox,
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
            Upravljaj oglasima, poslanim prijavama i pristiglim ponudama.
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
        className="grid gap-4 sm:grid-cols-3"
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
              <span className="text-2xl font-bold">
                {isLoading ? '—' : count}
              </span>
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
                {isLoading ? '—' : count}
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
            onClick={() => void loadWorkspace()}
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
              {myListingsPage < myListingsTotalPages ? (
                <LoadMoreButton
                  isLoading={loadingMore === 'listings'}
                  onClick={loadMoreListings}
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
              title="Još nisi poslao nijednu prijavu"
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
              {myPage < myTotalPages ? (
                <LoadMoreButton
                  isLoading={loadingMore === 'applications'}
                  onClick={loadMoreMyApplications}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {!isLoading && !error && activeTab === 'received' ? (
        <section className="space-y-4" aria-label="Primljene prijave">
          {receivedApplications.length === 0 ? (
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
                {receivedApplications.map((application) => (
                  <ReceivedApplicationCard
                    key={application.id}
                    application={application}
                    listing={application.listing}
                    isUpdating={updatingId === application.id}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))}
              </div>
              {receivedPage < receivedTotalPages ? (
                <LoadMoreButton
                  isLoading={loadingMore === 'received'}
                  onClick={loadMoreReceivedApplications}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
