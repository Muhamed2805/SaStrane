'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Lock,
  LockOpen,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { useApplicationsStore } from '@/features/applications/store';
import { listingsApi, type ListingStatus } from '@/features/listings/api';
import { cn } from '@/lib/utils';

type ListingActionsProps = {
  listingId: string;
  clientId: string;
  status: ListingStatus;
};

export function ListingActions({
  listingId,
  clientId,
  status,
}: ListingActionsProps) {
  const router = useRouter();
  const { user, openAuthModal } = useAuthStore();
  const { openApply, hasApplied } = useApplicationsStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const isOwner = user?.id === clientId;
  const isClosed = status === 'CLOSED';
  const applied = hasApplied(listingId);

  // The page is rendered on the server, so a refresh shows the new status.
  const toggleStatus = async () => {
    setIsChangingStatus(true);
    try {
      await listingsApi.updateStatus(listingId, isClosed ? 'OPEN' : 'CLOSED');
      toast.success(
        isClosed
          ? 'Oglas je ponovo otvoren za prijave.'
          : 'Oglas je zatvoren. Nove prijave više nisu moguće.',
      );
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const performDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await listingsApi.delete(listingId);
      toast.success('Oglas je obrisan.');
      router.push('/listings');
    } catch (err) {
      toast.error((err as Error).message);
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    toast('Obrisati ovaj oglas?', {
      description: 'Ova radnja se ne može poništiti.',
      action: { label: 'Obriši', onClick: performDelete },
      cancel: { label: 'Otkaži', onClick: () => {} },
    });
  };

  if (isOwner) {
    return (
      <div className="space-y-3">
        <Link
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          href={`/listings/${listingId}/edit`}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Uredi oglas
        </Link>
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          disabled={isChangingStatus}
          onClick={toggleStatus}
        >
          {isClosed ? (
            <LockOpen className="size-4" aria-hidden="true" />
          ) : (
            <Lock className="size-4" aria-hidden="true" />
          )}
          {isClosed ? 'Ponovo otvori oglas' : 'Zatvori oglas'}
        </button>
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {isDeleting ? 'Brišem...' : 'Obriši oglas'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-dark disabled:cursor-not-allowed disabled:opacity-100',
          applied
            ? 'disabled:bg-primary'
            : 'disabled:bg-muted disabled:text-muted-foreground',
        )}
        type="button"
        disabled={applied || isClosed}
        onClick={() => {
          if (!user) openAuthModal();
          else openApply(listingId);
        }}
      >
        {isClosed && !applied ? (
          <>
            <Lock className="size-4" aria-hidden="true" />
            Oglas je zatvoren
          </>
        ) : applied ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            Prijava poslana
          </>
        ) : (
          <>
            <Send className="size-4" aria-hidden="true" />
            Prijavi se za posao
          </>
        )}
      </button>

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        onClick={() => {
          if (!user) openAuthModal();
          else toast.info('Razgovori dolaze uskoro.');
        }}
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        Pošalji poruku
      </button>
    </div>
  );
}
