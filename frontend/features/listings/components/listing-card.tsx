import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ImageIcon, MapPin, Tag } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import { formatPrice } from '@/lib/format-price';
import type { ListingSummary } from '../api';
import { CATEGORY_LABELS, LOCATION_LABELS } from '../constants';

export function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Link href={`/listings/${listing.id}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm shadow-slate-900/[0.02] transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
        <div className="relative aspect-[16/9] bg-muted">
          {listing.coverPhoto ? (
            <Image
              src={listing.coverPhoto.thumbnailUrl}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/[0.06] to-primary/[0.14] text-primary/40">
              <ImageIcon className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {CATEGORY_LABELS[listing.category]}
            </span>
            <span className="shrink-0 text-sm font-bold text-brand-orange-dark">
              {formatPrice(listing.budget)}
            </span>
          </div>

          <h2 className="mt-4 line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
            {listing.title}
          </h2>

          <div className="mt-auto space-y-2 pt-5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 text-primary" aria-hidden="true" />
              <span>{LOCATION_LABELS[listing.location]}</span>
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
        </div>
      </article>
    </Link>
  );
}
