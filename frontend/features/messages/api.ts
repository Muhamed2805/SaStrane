import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type Conversation = Schemas['ConversationDto'];
export type ConversationsPage = Schemas['ConversationsPageDto'];
export type Message = Schemas['MessageDto'];
export type MessagesPage = Schemas['MessagesPageDto'];
export type StartConversationPayload = Schemas['StartConversationDto'];

export const MAX_MESSAGE_LENGTH = 2000;

export const messagesApi = {
  start: (payload: StartConversationPayload) =>
    authRequest<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAll: (page: number, limit: number) =>
    authRequest<ConversationsPage>(
      `/conversations?page=${page}&limit=${limit}`,
    ),

  getUnreadCount: () =>
    authRequest<Schemas['UnreadCountDto']>('/conversations/unread-count'),

  getById: (id: string) => authRequest<Conversation>(`/conversations/${id}`),

  getMessages: (id: string, before?: string) => {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    return authRequest<MessagesPage>(`/conversations/${id}/messages${query}`);
  },

  send: (id: string, body: string) =>
    authRequest<Message>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  markRead: (id: string) =>
    authRequest<null>(`/conversations/${id}/read`, { method: 'POST' }),
};
