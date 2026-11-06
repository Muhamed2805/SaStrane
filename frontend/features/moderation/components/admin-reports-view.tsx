'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ban, Check, Flag, Trash2, UserCheck, X } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { formatDate } from '@/lib/format-date';
import { pageItems, pageTotal } from '@/lib/paging';
import { REPORT_REASON_LABELS, type Report, type ReportStatus } from '../api';
import { useAdminAction, type AdminAction } from '../hooks';
import { reportsQuery } from '../queries';
import {
  ActionButton,
  Badge,
  FilterTabs,
  ListState,
  LoadMore,
} from './admin-ui';

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

function ReportCard({
  report,
  busy,
  onAction,
}: {
  report: Report;
  busy: boolean;
  onAction: (action: AdminAction) => void;
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
          {reportedUser.suspended ? <Badge>Suspendovan nalog</Badge> : null}
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
              onClick={() => onAction({ kind: 'resolve', reportId: report.id })}
            />
            <ActionButton
              icon={X}
              label="Odbaci"
              disabled={busy}
              onClick={() => onAction({ kind: 'dismiss', reportId: report.id })}
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
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const reports = useInfiniteQuery(reportsQuery(userId, status));
  const action = useAdminAction();
  const items = pageItems(reports.data?.pages);

  return (
    <section className="space-y-6" aria-labelledby="admin-reports-title">
      <div>
        <h1
          id="admin-reports-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Prijave
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pregledaj prijavljene oglase i korisnike. Suspendovani nalog se ne
          može prijaviti, a otvoreni oglasi tog naloga se zatvaraju.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          tabs={TABS}
          value={status}
          onChange={setStatus}
          label="Status prijave"
        />
        <span className="text-sm text-muted-foreground">
          Ukupno: {pageTotal(reports.data?.pages) ?? '—'}
        </span>
      </div>

      <ListState
        isPending={reports.isPending}
        error={reports.data ? null : reports.error?.message}
        isEmpty={items.length === 0}
        emptyLabel={EMPTY_LABELS[status]}
        onRetry={() => void reports.refetch()}
      >
        <div className="space-y-4">
          {items.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={action.isPending}
              onAction={action.run}
            />
          ))}
          <LoadMore
            hasMore={reports.hasNextPage}
            isLoading={reports.isFetchingNextPage}
            onClick={() => void reports.fetchNextPage()}
          />
        </div>
      </ListState>
    </section>
  );
}
