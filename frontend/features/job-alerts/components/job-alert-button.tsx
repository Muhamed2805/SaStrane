'use client';

import { useQuery } from '@tanstack/react-query';
import { BellPlus, BellRing, LoaderCircle } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import type { ListingCategory, ListingLocation } from '@/features/listings/api';
import { useCreateJobAlert, useRemoveJobAlert } from '../hooks';
import { isAlertFor } from '../labels';
import { jobAlertsQuery } from '../queries';

type JobAlertButtonProps = {
  category?: ListingCategory;
  location?: ListingLocation;
};

// On the job list: turns the chosen kind of job and location into an alert,
// or turns that alert off. Without a filter there is nothing to watch.
export function JobAlertButton({ category, location }: JobAlertButtonProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const status = useAuthStore((state) => state.status);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const alerts = useQuery({
    ...jobAlertsQuery(userId ?? ''),
    enabled: Boolean(userId),
  });
  const { create, isCreating } = useCreateJobAlert(userId ?? '');
  const { remove, removingId } = useRemoveJobAlert(userId ?? '');

  if (!category && !location) return null;
  // Until the session is known, a click must not ask a signed-in user to
  // sign in.
  if (status === 'loading') return null;

  const buttonClass =
    'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-60';

  if (!userId) {
    return (
      <button
        type="button"
        onClick={openAuthModal}
        className={`${buttonClass} text-primary hover:border-primary/30 hover:bg-primary/5`}
      >
        <BellPlus className="size-4" aria-hidden="true" />
        Obavijesti me o novim oglasima
      </button>
    );
  }
  if (!alerts.data) return null;

  const alert = alerts.data.find((item) =>
    isAlertFor(item, { category, location }),
  );

  if (alert) {
    const isRemoving = removingId === alert.id;
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
          <BellRing className="size-4" aria-hidden="true" />
          Javljamo ti nove oglase
        </span>
        <button
          type="button"
          onClick={() => remove(alert.id)}
          disabled={isRemoving}
          className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {isRemoving ? (
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : null}
          Isključi
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => create({ category, location })}
      disabled={isCreating}
      className={`${buttonClass} text-primary hover:border-primary/30 hover:bg-primary/5`}
    >
      {isCreating ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <BellPlus className="size-4" aria-hidden="true" />
      )}
      Obavijesti me o novim oglasima
    </button>
  );
}
