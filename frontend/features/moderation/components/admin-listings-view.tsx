'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Lock, LockOpen, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { formatDate } from '@/lib/format-date';
import { pageItems, pageTotal } from '@/lib/paging';
import type { AdminListing, ListingStatus } from '../api';
import { useAdminAction, type AdminAction } from '../hooks';
import { adminListingsQuery } from '../queries';
import {
  ActionButton,
  Badge,
  FilterTabs,
  ListState,
  LoadMore,
  SearchBox,
  useDebouncedValue,
} from './admin-ui';

type Filter = ListingStatus | 'ALL';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'ALL', label: 'Svi' },
  { id: 'OPEN', label: 'Otvoreni' },
  { id: 'CLOSED', label: 'Zatvoreni' },
];

function ListingRow({
  listing,
  busy,
  onAction,
}: {
  listing: AdminListing;
  busy: boolean;
  onAction: (action: AdminAction) => void;
}) {
  const isOpen = listing.status === 'OPEN';

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/listings/${listing.id}`}
            className="truncate font-semibold hover:text-primary hover:underline"
          >
            {listing.title}
          </Link>
          <Badge tone={isOpen ? 'primary' : 'muted'}>
            {isOpen ? 'Otvoren' : 'Zatvoren'}
          </Badge>
          {listing.openReports > 0 ? (
            <Badge tone="danger">Otvorene prijave: {listing.openReports}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {CATEGORY_LABELS[listing.category]} ·{' '}
          {LOCATION_LABELS[listing.location]} · {formatDate(listing.createdAt)}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Klijent:</span>
          <Link
            href={`/users/${listing.client.id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {listing.client.fullName}
          </Link>
          {listing.client.suspended ? <Badge>Suspendovan nalog</Badge> : null}
          <span className="text-muted-foreground">
            · Prijave na posao: {listing.applications}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {isOpen ? (
          <ActionButton
            icon={Lock}
            label="Zatvori"
            disabled={busy}
            onClick={() =>
              onAction({ kind: 'close-listing', listingId: listing.id })
            }
          />
        ) : (
          <ActionButton
            icon={LockOpen}
            label="Otvori ponovo"
            disabled={busy || listing.client.suspended}
            onClick={() =>
              onAction({ kind: 'reopen-listing', listingId: listing.id })
            }
          />
        )}
        <ActionButton
          icon={Trash2}
          label="Obriši"
          tone="danger"
          disabled={busy}
          onClick={() =>
            onAction({ kind: 'delete-listing', listingId: listing.id })
          }
        />
      </div>
    </article>
  );
}

export function AdminListingsView() {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const q = useDebouncedValue(search.trim());
  const listings = useInfiniteQuery(
    adminListingsQuery(userId, q, filter === 'ALL' ? undefined : filter),
  );
  const action = useAdminAction();
  const items = pageItems(listings.data?.pages);

  return (
    <section className="space-y-6" aria-labelledby="admin-listings-title">
      <div>
        <h1
          id="admin-listings-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Oglasi
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Svi oglasi, i otvoreni i zatvoreni. Oglas suspendovanog naloga ostaje
          zatvoren dok se suspenzija ne ukine.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox
          value={search}
          onChange={setSearch}
          label="Pretraži oglase"
          placeholder="Naslov oglasa"
        />
        <FilterTabs
          tabs={FILTERS}
          value={filter}
          onChange={setFilter}
          label="Status oglasa"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Ukupno: {pageTotal(listings.data?.pages) ?? '—'}
      </p>

      <ListState
        isPending={listings.isPending}
        error={listings.data ? null : listings.error?.message}
        isEmpty={items.length === 0}
        emptyLabel="Nema oglasa za ovu pretragu."
        onRetry={() => void listings.refetch()}
      >
        <div className="space-y-3">
          {items.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              busy={action.isPending}
              onAction={action.run}
            />
          ))}
          <LoadMore
            hasMore={listings.hasNextPage}
            isLoading={listings.isFetchingNextPage}
            onClick={() => void listings.fetchNextPage()}
          />
        </div>
      </ListState>
    </section>
  );
}
