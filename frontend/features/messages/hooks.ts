import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { messagesApi, type StartConversationPayload } from './api';
import { messageKeys, unreadCountQuery } from './queries';

// Unread messages of the signed-in user, or undefined while signed out.
export function useUnreadCount() {
  const userId = useAuthStore((state) => state.user?.id);
  const { data } = useQuery({
    ...unreadCountQuery(userId ?? ''),
    enabled: Boolean(userId),
  });
  return userId ? data : undefined;
}

// Opens the conversation about a job, and starts it the first time. Signed
// out, it asks the user to sign in first.
export function useOpenConversation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, openAuthModal } = useAuthStore();

  const mutation = useMutation({
    mutationFn: (payload: StartConversationPayload) =>
      messagesApi.start(payload),
    onSuccess: (conversation) => {
      if (user) {
        queryClient.setQueryData(
          messageKeys.detail(user.id, conversation.id),
          conversation,
        );
      }
      router.push(`/messages/${conversation.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  return {
    open: (payload: StartConversationPayload) => {
      if (!user) openAuthModal();
      else mutation.mutate(payload);
    },
    isOpening: mutation.isPending,
  };
}
