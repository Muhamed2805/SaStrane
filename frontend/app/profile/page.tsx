'use client';

import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Inbox,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { ownedListingsQuery } from '@/features/listings/queries';
import {
  receivedApplicationsQuery,
  sentApplicationsQuery,
} from '@/features/applications/queries';
import { RatingSummary } from '@/features/ratings/components/rating-stars';
import { userProfileQuery } from '@/features/ratings/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { formatDate } from '@/lib/format-date';
import { pageTotal } from '@/lib/paging';

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Klijent',
  EXECUTOR: 'Izvođač',
  BOTH: 'Klijent i izvođač',
};

export default function ProfilePage() {
  const { user, status, openAuthModal } = useAuthStore();

  // The same first pages as the workspace, so moving between the two pages
  // needs no new requests.
  const userId = user?.id ?? '';
  const enabled = Boolean(user);
  const queries = [
    useInfiniteQuery({ ...ownedListingsQuery(userId), enabled }),
    useInfiniteQuery({ ...sentApplicationsQuery(userId), enabled }),
    useInfiniteQuery({ ...receivedApplicationsQuery(userId), enabled }),
  ];
  const [listings, applications, received] = queries.map((query) =>
    pageTotal(query.data?.pages),
  );
  // The rating as others see it on the public profile.
  const { data: publicProfile } = useQuery({
    ...userProfileQuery(userId),
    enabled,
  });
  const failed = queries.find((query) => query.error && !query.data);
  const error = failed?.error?.message ?? null;
  const reload = () => {
    for (const query of queries) {
      if (query.error) void query.refetch();
    }
  };

  if (status === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockKeyhole className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Prijavi se za pristup profilu
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Na jednom mjestu prati svoje oglase, poslane i primljene prijave.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-7 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Prijavi se
        </button>
      </section>
    );
  }

  const statisticCards = [
    {
      label: 'Moji oglasi',
      value: listings,
      href: '/inbox?tab=listings',
      icon: ClipboardList,
      iconClassName: 'bg-primary/10 text-primary',
    },
    {
      label: 'Poslane prijave',
      value: applications,
      href: '/inbox?tab=applications',
      icon: Send,
      iconClassName: 'bg-amber-50 text-brand-orange-dark',
    },
    {
      label: 'Primljene prijave',
      value: received,
      href: '/inbox?tab=received',
      icon: Inbox,
      iconClassName: 'bg-sky-50 text-sky-700',
    },
  ];

  return (
    <div className="space-y-8 pb-4">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary via-[#13aa9c] to-[#66c9bd] sm:h-32" />
        <div className="px-5 pb-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <UserAvatar
                name={user.fullName}
                url={user.avatarUrl}
                className="-mt-9 size-20 rounded-2xl border-4 border-card bg-primary text-2xl font-bold text-primary-foreground shadow-sm sm:-mt-10 sm:size-24"
              />
              <div className="sm:pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {user.fullName}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <BadgeCheck className="size-3.5" />
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upravljaj svojim aktivnostima na SaStrane platformi.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {publicProfile ? (
                    <RatingSummary
                      rating={publicProfile.rating}
                      className="text-sm"
                    />
                  ) : null}
                  <Link
                    href={`/users/${user.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Javni profil i ocjene
                  </Link>
                </div>
              </div>
            </div>
            <Link
              href="/listings/create"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-dark"
            >
              <Plus className="size-4" />
              Objavi oglas
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="activity-heading" className="text-xl font-bold">
              Pregled aktivnosti
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sve važne brojke na jednom mjestu.
            </p>
          </div>
          {error ? (
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <RefreshCw className="size-4" />
              Pokušaj ponovo
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Statistiku trenutno nije moguće učitati. {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          {statisticCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.label}
                href={card.href}
                className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl ${card.iconClassName}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mt-5 text-3xl font-bold tabular-nums">
                  {card.value ?? '—'}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Podaci o profilu</h2>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Settings className="size-4" aria-hidden="true" />
              Uredi
            </Link>
          </div>
          <dl className="mt-5 divide-y">
            <div className="flex items-center gap-4 py-4 first:pt-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Mail className="size-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email adresa
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold">
                  {user.email}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-4 py-4 last:pb-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Član od
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border bg-brand-navy p-6 text-white shadow-sm">
          <h2 className="text-lg font-bold">Šta želiš uraditi?</h2>
          <p className="mt-1 text-sm leading-6 text-white/65">
            Pronađi novu priliku ili objavi posao za koji ti treba pomoć.
          </p>
          <div className="mt-5 space-y-3">
            <Link
              href="/listings"
              className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
            >
              <span className="flex items-center gap-3">
                <Search className="size-4 text-[#72d4ca]" />
                Pronađi posao
              </span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/listings/create"
              className="flex items-center justify-between rounded-xl bg-brand-orange px-4 py-3 text-sm font-semibold transition-colors hover:bg-brand-orange-dark"
            >
              <span className="flex items-center gap-3">
                <Plus className="size-4" />
                Objavi novi oglas
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
