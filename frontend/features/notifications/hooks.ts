import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { notificationsApi } from './api';
import { notificationKeys, unreadNotificationsQuery } from './queries';

// Unread notifications of the signed-in user, or undefined while signed out.
export function useUnreadNotifications() {
  const userId = useAuthStore((state) => state.user?.id);
  const { data } = useQuery({
    ...unreadNotificationsQuery(userId ?? ''),
    enabled: Boolean(userId),
  });
  return userId ? data : undefined;
}

// The badge and the list load again after a change.
function useRefresh(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.all(userId) });
}

// Opening a notification marks it read. A failure is not shown: the user is
// already on the way to the page it leads to.
export function useMarkNotificationRead(userId: string) {
  const refresh = useRefresh(userId);
  const mutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSettled: refresh,
  });
  return (id: string) => mutation.mutate(id);
}

export function useMarkAllNotificationsRead(userId: string) {
  const refresh = useRefresh(userId);
  const mutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onError: (error) => toast.error(error.message),
    onSettled: refresh,
  });
  return {
    markAllRead: () => mutation.mutate(),
    isMarking: mutation.isPending,
  };
}
