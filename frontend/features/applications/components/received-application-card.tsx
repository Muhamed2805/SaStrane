import Link from 'next/link';
import {
  Banknote,
  CalendarDays,
  Check,
  Mail,
  MapPin,
  MessageCircle,
  X,
} from 'lucide-react';
import { ClosedBadge } from '@/features/listings/components/closed-badge';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { formatDate } from '@/lib/format-date';
import { useOpenConversation } from '@/features/messages/hooks';
import { formatPrice } from '@/lib/format-price';
import type {
  ApplicationListing,
  ApplicationStatus,
  ListingApplication,
} from '../api';
import { ApplicationStatusBadge } from './application-status-badge';

type ReceivedApplicationCardProps = {
  application: ListingApplication;
  listing?: ApplicationListing;
  isUpdating: boolean;
  onStatusUpdate: (
    id: string,
    status: Extract<ApplicationStatus, 'ACCEPTED' | 'REJECTED'>,
  ) => void;
};

export function ReceivedApplicationCard({
  application,
  listing,
  isUpdating,
  onStatusUpdate,
}: ReceivedApplicationCardProps) {
  const { open: openConversation, isOpening } = useOpenConversation();
  const executorInitial = application.executor.fullName
    .charAt(0)
    .toUpperCase();
  const messageButton = (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-semibold hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
      disabled={isOpening}
      type="button"
      onClick={() =>
        openConversation({
          listingId: application.listingId,
          executorId: application.executor.id,
        })
      }
    >
      <MessageCircle className="size-3.5" aria-hidden="true" />
      Poruka
    </button>
  );

  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      {listing ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <Link
              href={`/listings/${application.listingId}`}
              className="font-semibold transition-colors hover:text-primary"
            >
              {listing.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                {CATEGORY_LABELS[listing.category]}
              </span>
              <span className="inline-flex items-center gap-1.5 py-1">
                <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                {LOCATION_LABELS[listing.location]}
              </span>
              <ClosedBadge status={listing.status} />
            </div>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <ApplicationStatusBadge status={application.status} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
          {executorInitial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {application.executor.fullName}
          </p>
          {application.executor.email ? (
            <a
              href={`mailto:${application.executor.email}`}
              className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-primary"
            >
              <Mail className="size-3.5" aria-hidden="true" />
              {application.executor.email}
            </a>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" aria-hidden="true" />
              Email je vidljiv nakon prihvatanja.
            </p>
          )}
        </div>
      </div>

      <blockquote className="mt-4 rounded-xl bg-muted/50 p-4 text-sm leading-6 text-foreground/80">
        “{application.message}”
      </blockquote>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-semibold text-brand-orange-dark">
          <Banknote className="size-3.5" aria-hidden="true" />
          Ponuda: {formatPrice(application.proposedPrice)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
          Primljeno {formatDate(application.createdAt)}
        </span>
      </div>

      {application.status === 'PENDING' ? (
        <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          {messageButton}
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            disabled={isUpdating}
            type="button"
            onClick={() => onStatusUpdate(application.id, 'REJECTED')}
          >
            <X className="size-3.5" aria-hidden="true" />
            Odbij
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            disabled={isUpdating}
            type="button"
            onClick={() => onStatusUpdate(application.id, 'ACCEPTED')}
          >
            <Check className="size-3.5" aria-hidden="true" />
            {isUpdating ? 'Ažuriram...' : 'Prihvati prijavu'}
          </button>
        </div>
      ) : (
        <div className="mt-5 flex justify-end border-t pt-4">
          {messageButton}
        </div>
      )}
    </article>
  );
}
