import Link from 'next/link';
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  MapPin,
  Pencil,
} from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import type { ListingFromApi } from '../api';

export function MyListingCard({ listing }: { listing: ListingFromApi }) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {listing.category}
          </span>
          <Link
            href={`/listings/${listing.id}`}
            className="mt-3 block text-lg font-semibold transition-colors hover:text-primary"
          >
            {listing.title}
          </Link>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-brand-orange-dark">
          <Banknote className="size-4" aria-hidden="true" />
          {listing.budget || 'Po dogovoru'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5 text-primary" aria-hidden="true" />
          {listing.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
          Objavljeno {formatDate(listing.createdAt)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <Link
          href={`/listings/${listing.id}/edit`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border px-4 text-xs font-semibold hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Uredi
        </Link>
        <Link
          href={`/listings/${listing.id}`}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-semibold text-white hover:bg-primary/90"
        >
          Pregledaj
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
