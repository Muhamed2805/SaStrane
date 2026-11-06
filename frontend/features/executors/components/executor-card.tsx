import Link from 'next/link';
import { BriefcaseBusiness, Clock, MapPin, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import {
  completedJobsLabel,
  formatAverage,
  ratingCountLabel,
  responseTimeLabel,
} from '@/features/ratings/format';
import type { Executor } from '../api';

export function ExecutorCard({ executor }: { executor: Executor }) {
  const { average, count } = executor.rating;
  const { completedJobs, responseMinutes } = executor.stats;
  const nameId = `executor-${executor.id}-name`;

  // The name names the link: a link holding an article gets no name from
  // its content.
  return (
    <Link
      href={`/users/${executor.id}`}
      aria-labelledby={nameId}
      className="group block h-full"
    >
      <article className="flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={executor.fullName}
            url={executor.avatarUrl}
            className="size-14 rounded-xl bg-primary text-xl font-bold text-white"
          />
          <div className="min-w-0">
            <h2
              id={nameId}
              className="truncate font-semibold transition-colors group-hover:text-primary"
            >
              {executor.fullName}
            </h2>
            {executor.location ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                {LOCATION_LABELS[executor.location]}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-sm">
          {average === null ? (
            <span className="text-muted-foreground">Još nema ocjena</span>
          ) : (
            <>
              <Star
                className="size-4 fill-amber-400 text-amber-400"
                aria-hidden="true"
              />
              <span className="font-semibold">{formatAverage(average)}</span>
              <span className="text-muted-foreground">
                · {ratingCountLabel(count)}
              </span>
            </>
          )}
        </p>
        {completedJobs > 0 || responseMinutes !== null ? (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {completedJobs > 0 ? (
              <p className="flex items-center gap-1.5">
                <BriefcaseBusiness
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                {completedJobsLabel(completedJobs)}
              </p>
            ) : null}
            {responseMinutes !== null ? (
              <p className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" aria-hidden="true" />
                {responseTimeLabel(responseMinutes)}
              </p>
            ) : null}
          </div>
        ) : null}

        {executor.bio ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {executor.bio}
          </p>
        ) : null}

        <ul
          className="mt-auto flex flex-wrap gap-1.5 pt-4"
          aria-label="Poslovi koje radi"
        >
          {executor.skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
            >
              {CATEGORY_LABELS[skill]}
            </li>
          ))}
        </ul>
      </article>
    </Link>
  );
}

export function ExecutorCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-5 h-4 w-1/3" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}
