'use client';

import { Bookmark } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { cn } from '@/lib/utils';
import { useSavedListingIds, useToggleSavedListing } from '../hooks';

type SaveListingButtonProps = {
  listingId: string;
  clientId: string;
  // An icon over a job card, or a full-width button on the job page.
  variant?: 'icon' | 'full';
};

// Hidden on the user's own jobs. A signed-out user is asked to sign in.
export function SaveListingButton({
  listingId,
  clientId,
  variant = 'icon',
}: SaveListingButtonProps) {
  const { user, openAuthModal } = useAuthStore();
  const savedIds = useSavedListingIds();
  const toggle = useToggleSavedListing(user?.id ?? '');

  if (user?.id === clientId) return null;

  const saved = savedIds?.has(listingId) ?? false;
  const label = saved ? 'Ukloni iz sačuvanih' : 'Sačuvaj oglas';
  const onClick = () => {
    if (!user) openAuthModal();
    else toggle.mutate({ listingId, save: !saved });
  };
  const icon = (
    <Bookmark
      className={cn('size-4', saved && 'fill-current')}
      aria-hidden="true"
    />
  );

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={saved}
        title={label}
        className={cn(
          'flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:text-primary',
          saved ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
        saved && 'border-primary/30 bg-primary/5 text-primary',
      )}
    >
      {icon}
      {saved ? 'Sačuvano' : 'Sačuvaj oglas'}
    </button>
  );
}
