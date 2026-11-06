'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Ban,
  Check,
  Flag,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/features/auth/store';
import { listingKeys } from '@/features/listings/queries';
import { formatDate } from '@/lib/format-date';
import { pageItems, pageTotal } from '@/lib/paging';
import { cn } from '@/lib/utils';
import {
  moderationApi,
  REPORT_REASON_LABELS,
  type Report,
  type ReportStatus,
} from '../api';
import { moderationKeys, reportsQuery } from '../queries';

const TABS: Array<{ id: ReportStatus; label: string }> = [
  { id: 'OPEN', label: 'Otvorene' },
  { id: 'RESOLVED', label: 'Riješene' },
  { id: 'DISMISSED', label: 'Odbačene' },
];

const EMPTY_LABELS: Record<ReportStatus, string> = {
  OPEN: 'Nema otvorenih prijava.',
  RESOLVED: 'Još nema riješenih prijava.',
  DISMISSED: 'Još nema odbačenih prijava.',
};

type Action =
  | { kind: 'resolve' | 'dismiss'; report: Report }
  | { kind: 'delete-listing'; listingId: string }
  | { kind: 'suspend' | 'unsuspend'; userId: string };

const SUCCESS: Record<Action['kind'], string> = {
  resolve: 'Prijava je označena kao riješena.',
  dismiss: 'Prijava je odbačena.',
  'delete-listing': 'Oglas je obrisan.',
  suspend: 'Nalog je suspendovan.',
  unsuspend: 'Suspenzija je ukinuta.',
};

function run(action: Action) {
  switch (action.kind) {
    case 'resolve':
      return moderationApi.handle(action.report.id, 'RESOLVED');
    case 'dismiss':
      return moderationApi.handle(action.report.id, 'DISMISSED');
    case 'delete-listing':
      return moderationApi.deleteListing(action.listingId);
    case 'suspend':
      return moderationApi.suspend(action.userId);
    case 'unsuspend':
      return moderationApi.unsuspend(action.userId);
  }
}

// Asks first, because these cannot be undone in one click.
function confirmFirst(title: string, onConfirm: () => void) {
  toast(title, {
    description: 'Provjeri prijavu prije potvrde.',
    action: { label: 'Potvrdi', onClick: onConfirm },
    cancel: { label: 'Otkaži', onClick: () => {} },
  });
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function ReportCard({
  report,
  busy,
  onAction,
}: {
  report: Report;
  busy: boolean;
  onAction: (action: Action) => void;
}) {
  const { listing, reportedUser } = report;

  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <Flag className="size-3" aria-hidden="true" />
          {REPORT_REASON_LABELS[report.reason]}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(report.createdAt)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        {listing ? (
          <>
            <dt className="text-muted-foreground">Oglas</dt>
            <dd className="min-w-0 truncate font-medium">
              {listing.id ? (
                <Link
                  href={`/listings/${listing.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {listing.title}
                </Link>
              ) : (
                <>
                  {listing.title}{' '}
                  <span className="text-muted-foreground">(obrisan)</span>
                </>
              )}
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">
          {listing ? 'Klijent' : 'Korisnik'}
        </dt>
        <dd className="flex min-w-0 items-center gap-2 font-medium">
          <Link
            href={`/users/${reportedUser.id}`}
            className="truncate hover:text-primary hover:underline"
          >
            {reportedUser.fullName}
          </Link>
          {reportedUser.suspended ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Suspendovan nalog
            </span>
          ) : null}
        </dd>
        <dt className="text-muted-foreground">Prijava od</dt>
        <dd className="min-w-0 truncate">{report.reporter.fullName}</dd>
      </dl>

      {report.details ? (
        <p className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-sm leading-6 whitespace-pre-line">
          {report.details}
        </p>
      ) : null}

      {report.status !== 'OPEN' && report.handledAt ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Obrađeno {formatDate(report.handledAt)}
          {report.handledBy ? ` · ${report.handledBy.fullName}` : ''}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
        {report.status === 'OPEN' ? (
          <>
            <ActionButton
              icon={Check}
              label="Riješeno"
              disabled={busy}
              onClick={() => onAction({ kind: 'resolve', report })}
            />
            <ActionButton
              icon={X}
              label="Odbaci"
              disabled={busy}
              onClick={() => onAction({ kind: 'dismiss', report })}
            />
          </>
        ) : null}
        {listing?.id ? (
          <ActionButton
            icon={Trash2}
            label="Obriši oglas"
            tone="danger"
            disabled={busy}
            onClick={() =>
              onAction({ kind: 'delete-listing', listingId: listing.id! })
            }
          />
        ) : null}
        {reportedUser.suspended ? (
          <ActionButton
            icon={UserCheck}
            label="Ukini suspenziju"
            disabled={busy}
            onClick={() =>
              onAction({ kind: 'unsuspend', userId: reportedUser.id })
            }
          />
        ) : (
          <ActionButton
            icon={Ban}
            label="Suspenduj nalog"
            tone="danger"
            disabled={busy}
            onClick={() =>
              onAction({ kind: 'suspend', userId: reportedUser.id })
            }
          />
        )}
      </div>
    </article>
  );
}

export function AdminReportsView() {
  const { user, status: authStatus, openAuthModal } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const userId = user?.id ?? '';
  const isAdmin = Boolean(user?.isAdmin);

  const reports = useInfiniteQuery({
    ...reportsQuery(userId, status),
    enabled: isAdmin,
  });

  const mutation = useMutation({
    mutationFn: run,
    onSuccess: (_result, action) => {
      toast.success(SUCCESS[action.kind]);
      if (action.kind === 'delete-listing') {
        queryClient.removeQueries({
          queryKey: listingKeys.detail(action.listingId),
        });
        void queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
      }
    },
    onError: (error) => toast.error(error.message),
    // Every action can change reports in each tab.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: moderationKeys.all(userId) }),
  });

  const onAction = (action: Action) => {
    if (action.kind === 'delete-listing') {
      confirmFirst('Obrisati oglas?', () => mutation.mutate(action));
    } else if (action.kind === 'suspend') {
      confirmFirst('Suspendovati nalog?', () => mutation.mutate(action));
    } else {
      mutation.mutate(action);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">
          Stranica je samo za administratore
        </h1>
        {!user ? (
          <button
            type="button"
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            onClick={openAuthModal}
          >
            Prijavi se
          </button>
        ) : null}
      </div>
    );
  }

  const items = pageItems(reports.data?.pages);
  const error = reports.data ? null : reports.error?.message;

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Administracija
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Prijave
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pregledaj prijavljene oglase i korisnike. Suspendovani nalog se ne
          može prijaviti, a otvoreni oglasi tog naloga se zatvaraju.
        </p>
      </header>

      <div className="overflow-x-auto border-b">
        <div className="flex min-w-max gap-7" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              onClick={() => setStatus(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                status === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {status === tab.id ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  {pageTotal(reports.data?.pages) ?? '—'}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Prijave nisu učitane</p>
          <p className="mt-1 text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void reports.refetch()}
            className="mt-4 inline-flex items-center gap-2 font-semibold underline"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Pokušaj ponovo
          </button>
        </div>
      ) : reports.isPending ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center text-sm text-muted-foreground">
          {EMPTY_LABELS[status]}
        </p>
      ) : (
        <section className="space-y-4" aria-label="Prijave">
          {items.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={mutation.isPending}
              onAction={onAction}
            />
          ))}
          {reports.hasNextPage ? (
            <button
              type="button"
              onClick={() => void reports.fetchNextPage()}
              disabled={reports.isFetchingNextPage}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold text-muted-foreground hover:border-primary/30 hover:text-primary disabled:opacity-50"
            >
              {reports.isFetchingNextPage ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Učitaj još
            </button>
          ) : null}
        </section>
      )}
    </div>
  );
}
