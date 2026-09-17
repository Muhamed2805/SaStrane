import Link from 'next/link';
import { CalendarDays, MapPin, Tag } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import type { ListingFromApi } from '../api';

export function ListingCard({ listing }: { listing: ListingFromApi }) {
  return (
    <Link href={`/listings/${listing.id}`} className="group block h-full">
      <article className="flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {listing.category}
          </span>
          {listing.budget ? (
            <span className="shrink-0 text-sm font-bold text-brand-orange-dark">
              {listing.budget}
            </span>
          ) : null}
        </div>

        <h2 className="mt-4 line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
          {listing.title}
        </h2>

        {listing.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {listing.description}
          </p>
        ) : null}

        <div className="mt-auto space-y-2 pt-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 text-primary" aria-hidden="true" />
            <span>{listing.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="size-3.5 text-primary" aria-hidden="true" />
            <span>{listing.client.fullName}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            <span>{formatDate(listing.createdAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
