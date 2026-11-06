'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  MapPin,
  MessageCircle,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { ClosedBadge } from '@/features/listings/components/closed-badge';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { formatDate } from '@/lib/format-date';
import { useOpenConversation } from '@/features/messages/hooks';
import { RateClientDialog } from '@/features/ratings/components/rate-client-dialog';
import { RatingStars } from '@/features/ratings/components/rating-stars';
import { formatPrice } from '@/lib/format-price';
import type { MyApplication } from '../api';
import { ApplicationStatusBadge } from './application-status-badge';

export function MyApplicationCard({
  application,
}: {
  application: MyApplication;
}) {
  const { open: openConversation, isOpening } = useOpenConversation();
  const userId = useAuthStore((state) => state.user?.id);
  const [isRating, setIsRating] = useState(false);

  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link
            href={`/listings/${application.listingId}`}
            className="font-semibold transition-colors hover:text-primary"
          >
            {application.listing.title}
          </Link>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
              {CATEGORY_LABELS[application.listing.category]}
            </span>
            <span className="inline-flex items-center gap-1.5 py-1">
              <MapPin className="size-3.5 text-primary" aria-hidden="true" />
              {LOCATION_LABELS[application.listing.location]}
            </span>
            <ClosedBadge status={application.listing.status} />
          </div>
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {application.message}
      </p>

      {application.rating ? (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            Ocjena od klijenta:
            <RatingStars score={application.rating.score} />
          </p>
          {application.rating.comment ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/80">
              {application.rating.comment}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-orange-dark">
            <Banknote className="size-3.5" aria-hidden="true" />
            {formatPrice(application.proposedPrice)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            Poslano {formatDate(application.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {application.clientRating ? (
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              Tvoja ocjena klijenta:
              <RatingStars score={application.clientRating.score} />
            </p>
          ) : null}
          {application.canRateClient && userId ? (
            <button
              type="button"
              onClick={() => setIsRating(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80"
            >
              <Star className="size-3.5" aria-hidden="true" />
              Ocijeni klijenta
            </button>
          ) : null}
          <button
            type="button"
            disabled={isOpening}
            onClick={() =>
              openConversation({ listingId: application.listingId })
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Poruka klijentu
          </button>
          <Link
            href={`/listings/${application.listingId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            Otvori oglas
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {isRating && userId ? (
        <RateClientDialog
          userId={userId}
          applicationId={application.id}
          listingTitle={application.listing.title}
          onClose={() => setIsRating(false)}
        />
      ) : null}
    </article>
  );
}
