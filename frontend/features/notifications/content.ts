import type { Notification } from './api';

export type NotificationContent = {
  title: string;
  href: string;
};

const listingHref = (notification: Notification, fallback: string) =>
  notification.listingId
    ? `/listings/${encodeURIComponent(notification.listingId)}`
    : fallback;

// What a notification says and where it leads. The job may be deleted, then
// it leads to the workspace tab instead.
export function notificationContent(
  notification: Notification,
  userId: string,
): NotificationContent {
  switch (notification.type) {
    case 'INVITATION':
      return {
        title: 'Novi poziv na posao',
        href: listingHref(notification, '/inbox?tab=invitations'),
      };
    case 'NEW_APPLICATION':
      return {
        title: 'Nova prijava na tvoj oglas',
        href: listingHref(notification, '/inbox?tab=received'),
      };
    case 'APPLICATION_ACCEPTED':
      return {
        title: 'Tvoja prijava je prihvaćena',
        href: '/inbox?tab=applications',
      };
    case 'APPLICATION_REJECTED':
      return {
        title: 'Tvoja prijava je odbijena',
        href: '/inbox?tab=applications',
      };
    case 'NEW_RATING':
      return {
        title: 'Nova ocjena za tvoj rad',
        href: `/users/${encodeURIComponent(userId)}`,
      };
  }
}
