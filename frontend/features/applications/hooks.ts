import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { invitationKeys } from '@/features/invitations/queries';
import { ApiError } from '@/lib/api-client';
import {
  applicationsApi,
  type ApplicationStatus,
  type CreateApplicationPayload,
} from './api';
import {
  applicationDecided,
  applicationKeys,
  appliedListingIdsQuery,
} from './queries';

export type DecidedStatus = Extract<ApplicationStatus, 'ACCEPTED' | 'REJECTED'>;

// The jobs the signed-in user applied to. Empty while signed out.
export function useAppliedListingIds() {
  const userId = useAuthStore((state) => state.user?.id);
  const { data } = useQuery({
    ...appliedListingIdsQuery(userId ?? ''),
    enabled: Boolean(userId),
  });
  return data;
}

export function useApplyToListing(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateApplicationPayload) =>
      applicationsApi.apply(payload),
    onSuccess: (_application, { listingId }) => {
      queryClient.setQueryData<string[]>(
        applicationKeys.appliedListingIds(userId),
        (listingIds = []) => [...listingIds, listingId],
      );
      void queryClient.invalidateQueries({
        queryKey: applicationKeys.all(userId),
      });
      // An invitation to this job now shows the application.
      void queryClient.invalidateQueries({
        queryKey: invitationKeys.received(userId),
      });
    },
  });
}

// Accepts or rejects an application to one of the user's jobs.
export function useDecideApplication(userId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DecidedStatus }) =>
      applicationsApi.updateStatus(id, { status }),
    onSuccess: (updated, { status }) => {
      applicationDecided(queryClient, userId, updated);
      toast.success(
        status === 'ACCEPTED'
          ? 'Prijava je prihvaćena.'
          : 'Prijava je odbijena.',
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Status nije ažuriran.',
      );
      // Someone decided first, for example in another tab: show that.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: applicationKeys.all(userId),
        });
      }
    },
  });

  return {
    decide: (id: string, status: DecidedStatus) =>
      mutation.mutate({ id, status }),
    updatingId: mutation.isPending ? mutation.variables.id : null,
  };
}
