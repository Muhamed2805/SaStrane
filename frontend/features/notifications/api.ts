import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type Notification = Schemas['NotificationDto'];
export type NotificationType = Schemas['NotificationType'];
export type NotificationsPage = Schemas['NotificationsPageDto'];

export const notificationsApi = {
  // Newest first.
  getAll: (page: number, limit: number) =>
    authRequest<NotificationsPage>(
      `/notifications?page=${page}&limit=${limit}`,
    ),

  getUnreadCount: () =>
    authRequest<Schemas['UnreadNotificationsDto']>(
      '/notifications/unread-count',
    ),

  // Both answer 204 without a body.
  markRead: (id: string) =>
    authRequest<null>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    }),

  markAllRead: () =>
    authRequest<null>('/notifications/read-all', { method: 'POST' }),
};
