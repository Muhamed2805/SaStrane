'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  BriefcaseBusiness,
  Flag,
  FolderClosed,
  Send,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/features/auth/store';
import { cn } from '@/lib/utils';
import type { AdminStats } from '../api';
import { statsQuery } from '../queries';
import { ListState } from './admin-ui';

type Card = {
  label: string;
  value: (stats: AdminStats) => number;
  // The part created in the last 7 days.
  recent?: (stats: AdminStats) => number;
  icon: LucideIcon;
  href?: string;
  alert?: boolean;
};

const CARDS: Card[] = [
  {
    label: 'Otvorene prijave',
    value: (s) => s.openReports,
    icon: Flag,
    href: '/admin/reports',
    alert: true,
  },
  {
    label: 'Korisnici',
    value: (s) => s.users,
    recent: (s) => s.newUsers,
    icon: Users,
    href: '/admin/users',
  },
  {
    label: 'Suspendovani nalozi',
    value: (s) => s.suspendedUsers,
    icon: Ban,
    href: '/admin/users',
  },
  {
    label: 'Otvoreni oglasi',
    value: (s) => s.openListings,
    recent: (s) => s.newListings,
    icon: BriefcaseBusiness,
    href: '/admin/listings',
  },
  {
    label: 'Zatvoreni oglasi',
    value: (s) => s.closedListings,
    icon: FolderClosed,
    href: '/admin/listings',
  },
  {
    label: 'Prijave na poslove',
    value: (s) => s.applications,
    recent: (s) => s.newApplications,
    icon: Send,
  },
];

function StatCard({ card, stats }: { card: Card; stats: AdminStats }) {
  const value = card.value(stats);
  const highlighted = card.alert && value > 0;
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          {card.label}
        </span>
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-lg',
            highlighted
              ? 'bg-red-50 text-red-600'
              : 'bg-primary/10 text-primary',
          )}
        >
          <card.icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p
        className={cn(
          'mt-3 text-3xl font-bold tracking-tight',
          highlighted && 'text-red-600',
        )}
      >
        {value}
      </p>
      {card.recent ? (
        <p className="mt-1 text-xs text-muted-foreground">
          +{card.recent(stats)} u zadnjih 7 dana
        </p>
      ) : null}
    </>
  );
  const className = cn(
    'block rounded-xl border bg-white p-5 shadow-sm',
    card.href && 'transition-colors hover:border-primary/30',
    highlighted && 'border-red-200',
  );
  return card.href ? (
    <Link href={card.href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function AdminOverview() {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const stats = useQuery(statsQuery(userId));

  return (
    <section className="space-y-6" aria-labelledby="admin-overview-title">
      <div>
        <h1
          id="admin-overview-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Pregled
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Stanje platforme na jednom mjestu. Kartice vode do prijava, korisnika
          i oglasa.
        </p>
      </div>
      <ListState
        isPending={stats.isPending}
        error={stats.data ? null : stats.error?.message}
        isEmpty={false}
        emptyLabel=""
        onRetry={() => void stats.refetch()}
      >
        {stats.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((card) => (
              <StatCard key={card.label} card={card} stats={stats.data} />
            ))}
          </div>
        ) : (
          <Skeleton className="h-32 rounded-xl" />
        )}
      </ListState>
    </section>
  );
}
