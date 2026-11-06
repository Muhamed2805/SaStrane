import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { savedListingsApi } from './api';
import { savedListingIdsQuery, savedListingKeys } from './queries';

// The jobs the signed-in user saved. Undefined while signed out.
export function useSavedListingIds() {
  const userId = useAuthStore((state) => state.user?.id);
  const { data } = useQuery({
    ...savedListingIdsQuery(userId ?? ''),
    enabled: Boolean(userId),
  });
  return data;
}

// Saves or removes a job. The button changes at once and goes back if the
// request fails.
export function useToggleSavedListing(userId: string) {
  const queryClient = useQueryClient();
  const idsKey = savedListingKeys.ids(userId);

  return useMutation({
    mutationFn: ({ listingId, save }: { listingId: string; save: boolean }) =>
      save
        ? savedListingsApi.save(listingId)
        : savedListingsApi.unsave(listingId),
    onMutate: async ({ listingId, save }) => {
      await queryClient.cancelQueries({ queryKey: idsKey });
      const previous = queryClient.getQueryData<string[]>(idsKey);
      queryClient.setQueryData<string[]>(idsKey, (ids = []) => {
        const others = ids.filter((id) => id !== listingId);
        return save ? [...others, listingId] : others;
      });
      return { previous };
    },
    onSuccess: (_result, { save }) => {
      toast.success(
        save ? 'Oglas je sačuvan.' : 'Oglas je uklonjen iz sačuvanih.',
      );
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(idsKey, context?.previous);
      toast.error(
        error instanceof Error ? error.message : 'Promjena nije sačuvana.',
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: savedListingKeys.all(userId),
      });
    },
  });
}
