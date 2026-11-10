'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applicationKeys } from '@/features/applications/queries';
import { useAuthStore } from '@/features/auth/store';
import { invitationKeys } from '@/features/invitations/queries';
import { listingKeys } from '@/features/listings/queries';
import { messageKeys } from '@/features/messages/queries';
import { notificationKeys } from '@/features/notifications/queries';
import { profileKeys } from '@/features/ratings/queries';
import { connectLive } from '../connection';

// While a user is signed in, loads again what the server says has changed:
// a new message shows in the open conversation, the list and the badge, and
// a new notification on the bell and in the workspace, without waiting for
// the next poll or a reload. Only what a page shows is loaded again.
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
    // A notification tells of an application, a decision, an invitation,
    // a rating or a job that expires: the bell, and the lists and the
    // profile that show the same thing.
    const reloadNotified = () => {
      reload(notificationKeys.all(userId));
      reload(applicationKeys.all(userId));
      reload(invitationKeys.received(userId));
      reload(listingKeys.owned(userId));
      reload(profileKeys.detail(userId));
    };
    let openedBefore = false;

    return connectLive((event) => {
      switch (event.type) {
        case 'ready':
          // Events were missed while the stream was closed.
          if (openedBefore) {
            reload(messageKeys.all(userId));
            reloadNotified();
          }
          openedBefore = true;
          break;
        case 'message':
          reload(messageKeys.messages(userId, event.conversationId));
          reload(messageKeys.list(userId));
          reload(messageKeys.unreadCount(userId));
          break;
        case 'read':
          reload(messageKeys.list(userId));
          reload(messageKeys.unreadCount(userId));
          break;
        case 'notification':
          reloadNotified();
          break;
      }
    });
  }, [userId, queryClient]);

  return null;
}
