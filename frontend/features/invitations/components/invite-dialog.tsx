'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { MAX_INVITATIONS_PER_LISTING, type InvitationOption } from '../api';
import { useInvite } from '../hooks';
import { invitationOptionsQuery } from '../queries';

type InviteDialogProps = {
  userId: string;
  executorId: string;
  executorName: string;
  onClose: () => void;
};

function OptionState({
  option,
  isInviting,
  disabled,
  onInvite,
}: {
  option: InvitationOption;
  isInviting: boolean;
  disabled: boolean;
  onInvite: () => void;
}) {
  if (option.state === 'INVITED') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
        <Check className="size-3.5" aria-hidden="true" />
        Poziv poslan
      </span>
    );
  }
  if (option.state === 'APPLIED') {
    return (
      <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        Prijava stigla
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onInvite}
      disabled={disabled}
      aria-label={`Pozovi na oglas ${option.title}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
    >
      {isInviting ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Send className="size-3.5" aria-hidden="true" />
      )}
      Pozovi
    </button>
  );
}

// The client picks one of their open jobs for the user.
export function InviteDialog({
  userId,
  executorId,
  executorName,
  onClose,
}: InviteDialogProps) {
  const options = useQuery(invitationOptionsQuery(userId, executorId));
  const { invite, invitingId } = useInvite(userId, executorId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-brand-navy/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Zatvori poziv"
      />
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border bg-background p-6 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-dialog-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Zatvori"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <h2 id="invite-dialog-title" className="pr-10 text-xl font-bold">
          Pozovi na oglas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Izaberi oglas za koji pozivaš: {executorName}
        </p>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          {options.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : options.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Oglasi nisu učitani</p>
              <p className="mt-1 text-red-600">{options.error.message}</p>
              <button
                type="button"
                onClick={() => void options.refetch()}
                className="mt-3 inline-flex items-center gap-2 font-semibold underline"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Pokušaj ponovo
              </button>
            </div>
          ) : options.data.length === 0 ? (
            <div className="rounded-xl border border-dashed px-5 py-8 text-center">
              <p className="font-semibold">Nemaš otvorenih oglasa</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Objavi oglas, pa se vrati i pošalji poziv.
              </p>
              <Link
                href="/listings/create"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark"
              >
                <Plus className="size-4" aria-hidden="true" />
                Objavi oglas
              </Link>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Tvoji otvoreni oglasi">
              {options.data.map((option) => (
                <li
                  key={option.listingId}
                  className="flex items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold">
                      {option.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {CATEGORY_LABELS[option.category]}
                      <span aria-hidden="true">·</span>
                      <MapPin
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                      {LOCATION_LABELS[option.location]}
                    </p>
                  </div>
                  <OptionState
                    option={option}
                    isInviting={invitingId === option.listingId}
                    disabled={invitingId !== null}
                    onInvite={() => invite(option.listingId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Poziv stiže emailom i u radni prostor. Prijava se šalje kao i svaka
          druga. Na jedan oglas možeš pozvati najviše{' '}
          {MAX_INVITATIONS_PER_LISTING} izvođača.
        </p>
      </div>
    </div>
  );
}
