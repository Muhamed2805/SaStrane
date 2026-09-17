import Link from 'next/link';
import { Banknote, CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import type { ApplicationFromApi } from '../api';
import { ApplicationStatusBadge } from './application-status-badge';

export function MyApplicationCard({
  application,
}: {
  application: ApplicationFromApi;
}) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link
            href={`/listings/${application.listingId}`}
            className="font-semibold transition-colors hover:text-primary"
          >
            {application.listing?.title ?? `Oglas #${application.listingId}`}
          </Link>
          {application.listing ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                {application.listing.category}
              </span>
              <span className="inline-flex items-center gap-1.5 py-1">
                <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                {application.listing.location}
              </span>
            </div>
          ) : null}
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {application.message}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {application.proposedPrice ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-brand-orange-dark">
              <Banknote className="size-3.5" aria-hidden="true" />
              {application.proposedPrice}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            Poslano {formatDate(application.createdAt)}
          </span>
        </div>
        <Link
          href={`/listings/${application.listingId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Otvori oglas
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
