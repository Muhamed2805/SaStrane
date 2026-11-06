'use client';

import { useQueryClient } from '@tanstack/react-query';
import { applicationKeys } from '@/features/applications/queries';
import { ratingsApi } from '../api';
import { clientRatingGiven } from '../queries';
import { RateDialog } from './rate-dialog';

type RateClientDialogProps = {
  userId: string;
  applicationId: string;
  listingTitle: string;
  onClose: () => void;
};

// The executor rates the client of a job they did.
export function RateClientDialog({
  userId,
  applicationId,
  listingTitle,
  onClose,
}: RateClientDialogProps) {
  const queryClient = useQueryClient();

  return (
    <RateDialog
      title="Ocijeni klijenta"
      subtitle={listingTitle}
      placeholder="Kako je bilo raditi za ovog klijenta?"
      note="Ocjena je javna na profilu klijenta i ne može se kasnije promijeniti."
      send={(input) => ratingsApi.createForClient({ applicationId, ...input })}
      onRated={() => clientRatingGiven(queryClient, userId)}
      onFailed={() =>
        void queryClient.invalidateQueries({
          queryKey: applicationKeys.all(userId),
        })
      }
      onClose={onClose}
    />
  );
}
