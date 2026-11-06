'use client';

import Link from 'next/link';
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  LoaderCircle,
  MapPin,
} from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { formatDate } from '@/lib/format-date';
import { formatPrice } from '@/lib/format-price';
import type { ReceivedInvitation } from '../api';

type InvitationCardProps = {
  invitation: ReceivedInvitation;
  isDeclining: boolean;
  onDecline: (id: string) => void;
};

// An invitation in the invited user's workspace. Applying happens on the
// job's page, as for any job.
export function InvitationCard({
  invitation,
  isDeclining,
  onDecline,
}: InvitationCardProps) {
  const { listing, client, applied } = invitation;
  const listingHref = `/listings/${listing.id}`;

  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link
            href={listingHref}
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
            <span className="inline-flex items-center gap-1.5 py-1 font-semibold text-brand-orange-dark">
              <Banknote className="size-3.5" aria-hidden="true" />
              {formatPrice(listing.budget)}
            </span>
          </div>
        </div>
        {applied ? (
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Check className="size-3.5" aria-hidden="true" />
            Prijava poslana
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <UserAvatar
          name={client.fullName}
          url={client.avatarUrl}
          className="size-9 rounded-full bg-primary/10 text-sm font-semibold text-primary"
        />
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/users/${client.id}`}
            className="font-semibold text-foreground hover:text-primary"
          >
            {client.fullName}
          </Link>{' '}
          te poziva da se prijaviš na ovaj oglas.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
          Poziv stigao {formatDate(invitation.createdAt)}
        </span>
        {applied ? (
          <Link
            href={listingHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            Otvori oglas
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onDecline(invitation.id)}
              disabled={isDeclining}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-red-600 disabled:opacity-50"
            >
              {isDeclining ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Odbij poziv
            </button>
            <Link
              href={listingHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
            >
              Pogledaj i prijavi se
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
