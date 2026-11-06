'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { cn } from '@/lib/utils';
import { listingsApi } from '../api';
import { listingSaved } from '../queries';

// Keeps the owner's open job open for 30 days from now.
export function ExtendListingButton({
  listingId,
  className,
}: {
  listingId: string;
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const [isExtending, setIsExtending] = useState(false);

  const extend = async () => {
    if (!userId) return;
    setIsExtending(true);
    try {
      const listing = await listingsApi.extend(listingId);
      listingSaved(queryClient, userId, listing);
      toast.success('Oglas je produžen za 30 dana.');
      // The job page is rendered on the server.
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={extend}
      disabled={isExtending}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60',
        className,
      )}
    >
      {isExtending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <CalendarPlus className="size-4" aria-hidden="true" />
      )}
      Produži za 30 dana
    </button>
  );
}
