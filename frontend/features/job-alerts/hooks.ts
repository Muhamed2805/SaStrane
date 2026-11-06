import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jobAlertsApi, type CreateJobAlertPayload, type JobAlert } from './api';
import { jobAlertKeys } from './queries';

export function useCreateJobAlert(userId: string) {
  const queryClient = useQueryClient();
  const key = jobAlertKeys.all(userId);

  const mutation = useMutation({
    mutationFn: (payload: CreateJobAlertPayload) =>
      jobAlertsApi.create(payload),
    onSuccess: (alert) => {
      queryClient.setQueryData<JobAlert[]>(key, (alerts) =>
        alerts ? [alert, ...alerts] : alerts,
      );
      toast.success('Javit ćemo ti kad se pojavi nov oglas.');
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    create: (payload: CreateJobAlertPayload) => mutation.mutate(payload),
    isCreating: mutation.isPending,
  };
}

export function useRemoveJobAlert(userId: string) {
  const queryClient = useQueryClient();
  const key = jobAlertKeys.all(userId);

  const mutation = useMutation({
    mutationFn: (id: string) => jobAlertsApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<JobAlert[]>(key, (alerts) =>
        alerts?.filter((alert) => alert.id !== id),
      );
      toast.success('Upozorenje je obrisano.');
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    remove: (id: string) => mutation.mutate(id),
    removingId: mutation.isPending ? mutation.variables : null,
  };
}
