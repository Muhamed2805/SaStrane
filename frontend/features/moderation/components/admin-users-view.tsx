'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ban, UserCheck } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { useAuthStore } from '@/features/auth/store';
import { formatDate } from '@/lib/format-date';
import { pageItems, pageTotal } from '@/lib/paging';
import type { AdminUser, AdminUserFilter } from '../api';
import { useAdminAction, type AdminAction } from '../hooks';
import { adminUsersQuery } from '../queries';
import {
  ActionButton,
  Badge,
  FilterTabs,
  ListState,
  LoadMore,
  SearchBox,
  useDebouncedValue,
} from './admin-ui';

type Filter = AdminUserFilter | 'ALL';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'ALL', label: 'Svi' },
  { id: 'SUSPENDED', label: 'Suspendovani nalozi' },
  { id: 'ADMINS', label: 'Administratori' },
];

const ROLE_LABELS: Record<AdminUser['role'], string> = {
  CLIENT: 'Klijent',
  EXECUTOR: 'Izvođač',
  BOTH: 'Klijent i izvođač',
};

function UserRow({
  user,
  isSelf,
  busy,
  onAction,
}: {
  user: AdminUser;
  isSelf: boolean;
  busy: boolean;
  onAction: (action: AdminAction) => void;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <UserAvatar
          name={user.fullName}
          url={user.avatarUrl}
          className="size-12 rounded-full bg-primary/10 text-base font-bold text-primary"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/users/${user.id}`}
              className="truncate font-semibold hover:text-primary hover:underline"
            >
              {user.fullName}
            </Link>
            {user.isAdmin ? <Badge tone="primary">Administrator</Badge> : null}
            {user.suspendedAt ? (
              <Badge tone="danger">
                Suspendovan nalog od {formatDate(user.suspendedAt)}
              </Badge>
            ) : null}
            {!user.emailVerified ? (
              <Badge tone="warning">Email nije potvrđen</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {user.email}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]} · Član od {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      <dl className="flex gap-6 text-center text-xs text-muted-foreground">
        <div>
          <dt>Oglasi</dt>
          <dd className="text-base font-bold text-foreground">
            {user.listings}
          </dd>
        </div>
        <div>
          <dt>Prijave na poslove</dt>
          <dd className="text-base font-bold text-foreground">
            {user.applications}
          </dd>
        </div>
        <div>
          <dt>Otvorene prijave</dt>
          <dd
            className={
              user.openReports > 0
                ? 'text-base font-bold text-red-600'
                : 'text-base font-bold text-foreground'
            }
          >
            {user.openReports}
          </dd>
        </div>
      </dl>

      {/* Admins cannot be suspended, so they get no action. */}
      {!user.isAdmin && !isSelf ? (
        <div className="md:w-44 md:text-right">
          {user.suspendedAt ? (
            <ActionButton
              icon={UserCheck}
              label="Ukini suspenziju"
              disabled={busy}
              onClick={() => onAction({ kind: 'unsuspend', userId: user.id })}
            />
          ) : (
            <ActionButton
              icon={Ban}
              label="Suspenduj nalog"
              tone="danger"
              disabled={busy}
              onClick={() => onAction({ kind: 'suspend', userId: user.id })}
            />
          )}
        </div>
      ) : (
        <div className="hidden md:block md:w-44" />
      )}
    </article>
  );
}

export function AdminUsersView() {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const q = useDebouncedValue(search.trim());
  const users = useInfiniteQuery(
    adminUsersQuery(userId, q, filter === 'ALL' ? undefined : filter),
  );
  const action = useAdminAction();
  const items = pageItems(users.data?.pages);

  return (
    <section className="space-y-6" aria-labelledby="admin-users-title">
      <div>
        <h1
          id="admin-users-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Korisnici
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Svi nalozi, najnoviji prvi. Administratore dodaje komanda{' '}
          <code className="rounded bg-muted px-1">npm run admin</code> na
          serveru.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox
          value={search}
          onChange={setSearch}
          label="Pretraži korisnike"
          placeholder="Ime ili email"
        />
        <FilterTabs
          tabs={FILTERS}
          value={filter}
          onChange={setFilter}
          label="Vrsta naloga"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Ukupno: {pageTotal(users.data?.pages) ?? '—'}
      </p>

      <ListState
        isPending={users.isPending}
        error={users.data ? null : users.error?.message}
        isEmpty={items.length === 0}
        emptyLabel="Nema korisnika za ovu pretragu."
        onRetry={() => void users.refetch()}
      >
        <div className="space-y-3">
          {items.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === userId}
              busy={action.isPending}
              onAction={action.run}
            />
          ))}
          <LoadMore
            hasMore={users.hasNextPage}
            isLoading={users.isFetchingNextPage}
            onClick={() => void users.fetchNextPage()}
          />
        </div>
      </ListState>
    </section>
  );
}
