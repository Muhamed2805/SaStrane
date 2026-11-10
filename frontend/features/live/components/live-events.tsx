'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store';
import { invitationKeys } from '@/features/invitations/queries';
import { messageKeys } from '@/features/messages/queries';
import { notificationKeys } from '@/features/notifications/queries';
import { connectLive } from '../connection';

// While a user is signed in, loads again what the server says has changed:
// a new message shows in the open conversation, the list and the badge, and
// a new notification on the bell, without waiting for the next poll.
export function LiveEvents() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // A first load that is still on its way may carry the state from
    // before the event, and an invalidation alone would wait for it.
    const reload = (queryKey: readonly unknown[]) =>
      void queryClient
        .cancelQueries({
          queryKey,
          predicate: (query) => query.state.data === undefined,
        })
        .then(() => queryClient.invalidateQueries({ queryKey }));
    let openedBefore = false;

    return connectLive((event) => {
      switch (event.type) {
        case 'ready':
          // Events were missed while the stream was closed.
          if (openedBefore) {
            reload(messageKeys.all(userId));
            reload(notificationKeys.all(userId));
          }
          openedBefore = true;
          break;
        case 'message':
          reload(messageKeys.messages(userId, event.conversationId));
          reload(messageKeys.list(userId));
          reload(messageKeys.unreadCount(userId));
          break;
        case 'notification':
          reload(notificationKeys.all(userId));
          // An invitation shows on the job's page and in the inbox too.
          reload(invitationKeys.received(userId));
          break;
      }
    });
  }, [userId, queryClient]);

  return null;
}
