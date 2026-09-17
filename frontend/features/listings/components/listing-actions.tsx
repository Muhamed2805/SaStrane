'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { useApplicationsStore } from '@/features/applications/store';
import { listingsApi } from '@/features/listings/api';

type ListingActionsProps = {
  listingId: string;
  clientId: string;
};

export function ListingActions({ listingId, clientId }: ListingActionsProps) {
  const router = useRouter();
  const { user, token, openAuthModal } = useAuthStore();
  const { openApply, hasApplied } = useApplicationsStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === clientId;
  const applied = hasApplied(listingId);

  const performDelete = async () => {
    if (!token) return;
    setIsDeleting(true);
    try {
      await listingsApi.delete(listingId, token);
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
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-dark disabled:cursor-not-allowed disabled:bg-primary disabled:opacity-100"
        disabled={applied}
        onClick={() => {
          if (!user) openAuthModal();
          else openApply(listingId);
        }}
      >
        {applied ? (
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
