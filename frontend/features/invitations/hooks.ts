import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { invitationsApi, type InvitationOption } from './api';
import { invitationKeys } from './queries';

// The client invites one user to one of their jobs.
export function useInvite(userId: string, executorId: string) {
  const queryClient = useQueryClient();
  const optionsKey = invitationKeys.options(userId, executorId);

  const mutation = useMutation({
    mutationFn: (listingId: string) =>
      invitationsApi.invite({ listingId, executorId }),
    onSuccess: (_invitation, listingId) => {
      queryClient.setQueryData<InvitationOption[]>(optionsKey, (options) =>
        options?.map((option) =>
          option.listingId === listingId
            ? { ...option, state: 'INVITED' }
            : option,
        ),
      );
      toast.success('Poziv je poslan.');
    },
    onError: (error) => {
      toast.error(error.message);
      // The job closed, or the user applied or was invited elsewhere.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: optionsKey });
      }
    },
  });

  return {
    invite: (listingId: string) => mutation.mutate(listingId),
    invitingId: mutation.isPending ? mutation.variables : null,
  };
}

// The invited user declines. The client is not told.
export function useDeclineInvitation(userId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => invitationsApi.decline(id),
    onSuccess: () => toast.success('Poziv je odbijen.'),
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: invitationKeys.received(userId),
      }),
  });

  return {
    decline: (id: string) => mutation.mutate(id),
    decliningId: mutation.isPending ? mutation.variables : null,
  };
}
