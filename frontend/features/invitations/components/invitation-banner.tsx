'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Mail } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { useDeclineInvitation } from '../hooks';
import { listingInvitationQuery } from '../queries';

type InvitationBannerProps = {
  listingId: string;
  clientId: string;
};

// On an open job's page: tells the invited user who invited them, until
// they apply or decline.
export function InvitationBanner({
  listingId,
  clientId,
}: InvitationBannerProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const enabled = Boolean(userId) && userId !== clientId;
  const { data: invitation } = useQuery({
    ...listingInvitationQuery(userId ?? '', listingId),
    enabled,
  });
  const { decline, decliningId } = useDeclineInvitation(userId ?? '');

  if (!enabled || !invitation || invitation.applied) return null;
  const isDeclining = decliningId === invitation.id;

  return (
    <section
      aria-label="Poziv na oglas"
      className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.06] p-4"
    >
      <p className="flex gap-2.5 text-sm leading-6">
        <Mail
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>
          <span className="font-semibold">{invitation.client.fullName}</span> te
          poziva da se prijaviš na ovaj oglas.
        </span>
      </p>
      <button
        type="button"
        onClick={() => decline(invitation.id)}
        disabled={isDeclining}
        className="mt-2 ml-6.5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {isDeclining ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        Odbij poziv
      </button>
    </section>
  );
}
