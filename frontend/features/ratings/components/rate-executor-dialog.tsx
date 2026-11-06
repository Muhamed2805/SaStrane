'use client';

import { useQueryClient } from '@tanstack/react-query';
import { applicationKeys } from '@/features/applications/queries';
import { ratingsApi } from '../api';
import { ratingGiven } from '../queries';
import { RateDialog } from './rate-dialog';

type RateExecutorDialogProps = {
  userId: string;
  applicationId: string;
  executor: { id: string; fullName: string };
  listingTitle?: string;
  onClose: () => void;
};

// The client rates the executor they accepted.
export function RateExecutorDialog({
  userId,
  applicationId,
  executor,
  listingTitle,
  onClose,
}: RateExecutorDialogProps) {
  const queryClient = useQueryClient();

  return (
    <RateDialog
      title="Ocijeni izvođača"
      subtitle={`${executor.fullName}${listingTitle ? ` · ${listingTitle}` : ''}`}
      placeholder="Kako je prošao posao?"
      note="Ocjena je javna na profilu izvođača i ne može se kasnije promijeniti."
      send={(input) => ratingsApi.create({ applicationId, ...input })}
      onRated={() => ratingGiven(queryClient, userId, executor.id)}
      onFailed={() =>
        void queryClient.invalidateQueries({
          queryKey: applicationKeys.all(userId),
        })
      }
      onClose={onClose}
    />
  );
}
