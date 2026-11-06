import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { listingKeys } from '@/features/listings/queries';
import { moderationApi } from './api';
import { adminKeys } from './queries';

export type AdminAction =
  | { kind: 'resolve' | 'dismiss'; reportId: string }
  | {
      kind: 'delete-listing' | 'close-listing' | 'reopen-listing';
      listingId: string;
    }
  | { kind: 'suspend' | 'unsuspend'; userId: string };

const SUCCESS: Record<AdminAction['kind'], string> = {
  resolve: 'Prijava je označena kao riješena.',
  dismiss: 'Prijava je odbačena.',
  'delete-listing': 'Oglas je obrisan.',
  'close-listing': 'Oglas je zatvoren.',
  'reopen-listing': 'Oglas je ponovo otvoren.',
  suspend: 'Nalog je suspendovan.',
  unsuspend: 'Suspenzija je ukinuta.',
};

// These cannot be undone in one click, so they ask first.
const CONFIRM: Partial<Record<AdminAction['kind'], string>> = {
  'delete-listing': 'Obrisati oglas?',
  suspend: 'Suspendovati nalog?',
};

function send(action: AdminAction) {
  switch (action.kind) {
    case 'resolve':
      return moderationApi.handle(action.reportId, 'RESOLVED');
    case 'dismiss':
      return moderationApi.handle(action.reportId, 'DISMISSED');
    case 'delete-listing':
      return moderationApi.deleteListing(action.listingId);
    case 'close-listing':
      return moderationApi.setListingStatus(action.listingId, 'CLOSED');
    case 'reopen-listing':
      return moderationApi.setListingStatus(action.listingId, 'OPEN');
    case 'suspend':
      return moderationApi.suspend(action.userId);
    case 'unsuspend':
      return moderationApi.unsuspend(action.userId);
  }
}

// Runs an admin action, then refreshes the admin pages and the public job
// pages it changed.
export function useAdminAction() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  const mutation = useMutation({
    mutationFn: send,
    onSuccess: (_result, action) => {
      toast.success(SUCCESS[action.kind]);
      if ('listingId' in action) {
        if (action.kind === 'delete-listing') {
          queryClient.removeQueries({
            queryKey: listingKeys.detail(action.listingId),
          });
        } else {
          void queryClient.invalidateQueries({
            queryKey: listingKeys.detail(action.listingId),
          });
        }
      }
      if (action.kind !== 'resolve' && action.kind !== 'dismiss') {
        void queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
      }
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.all(userId) }),
  });

  const run = (action: AdminAction) => {
    const question = CONFIRM[action.kind];
    if (!question) {
      mutation.mutate(action);
      return;
    }
    toast(question, {
      description: 'Provjeri podatke prije potvrde.',
      action: { label: 'Potvrdi', onClick: () => mutation.mutate(action) },
      cancel: { label: 'Otkaži', onClick: () => {} },
    });
  };

  return { run, isPending: mutation.isPending };
}
