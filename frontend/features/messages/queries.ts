import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { nextPageParam } from '@/lib/paging';
import { USER_SCOPE } from '@/lib/query-client';
import { messagesApi, type Message, type MessagesPage } from './api';

const CONVERSATIONS_PAGE_SIZE = 20;

// How often the site asks for news. Polling stops while the tab is hidden.
export const POLL_MS = {
  thread: 5_000,
  list: 15_000,
  unreadCount: 30_000,
};

// Every conversation query belongs to the signed-in user.
export const messageKeys = {
  all: (userId: string) => [USER_SCOPE, userId, 'conversations'] as const,
  list: (userId: string) => [...messageKeys.all(userId), 'list'] as const,
  unreadCount: (userId: string) =>
    [...messageKeys.all(userId), 'unread-count'] as const,
  detail: (userId: string, id: string) =>
    [...messageKeys.all(userId), 'detail', id] as const,
  messages: (userId: string, id: string) =>
    [...messageKeys.all(userId), 'messages', id] as const,
};

export function conversationsQuery(userId: string) {
  return infiniteQueryOptions({
    queryKey: messageKeys.list(userId),
    queryFn: ({ pageParam }) =>
      messagesApi.getAll(pageParam, CONVERSATIONS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    refetchInterval: POLL_MS.list,
  });
}

const toCount = (data: { count: number }) => data.count;

export function unreadCountQuery(userId: string) {
  return queryOptions({
    queryKey: messageKeys.unreadCount(userId),
    queryFn: () => messagesApi.getUnreadCount(),
    select: toCount,
    refetchInterval: POLL_MS.unreadCount,
  });
}

export function conversationQuery(userId: string, id: string) {
  return queryOptions({
    queryKey: messageKeys.detail(userId, id),
    queryFn: () => messagesApi.getById(id),
  });
}

// Pages go from the newest messages back. A refetch loads every page again
// from the newest, so new messages never leave a gap.
export function messagesQuery(userId: string, id: string) {
  return infiniteQueryOptions({
    queryKey: messageKeys.messages(userId, id),
    queryFn: ({ pageParam }) => messagesApi.getMessages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessagesPage) =>
      lastPage.nextCursor ?? undefined,
    refetchInterval: POLL_MS.thread,
  });
}

// The messages of every loaded page, oldest first, each one once.
export function threadMessages(pages: MessagesPage[] | undefined): Message[] {
  const seen = new Set<string>();
  const newestFirst = (pages ?? []).flatMap((page) =>
    page.items.filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    }),
  );
  return newestFirst.reverse();
}

// Shows a sent message at once. The lists load again for the new order and
// the last message.
export function messageSent(
  queryClient: QueryClient,
  userId: string,
  conversationId: string,
  message: Message,
) {
  queryClient.setQueryData<InfiniteData<MessagesPage, string | undefined>>(
    messageKeys.messages(userId, conversationId),
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page, index) =>
          index === 0 ? { ...page, items: [message, ...page.items] } : page,
        ),
      },
  );
  void queryClient.invalidateQueries({ queryKey: messageKeys.list(userId) });
}

// After the user read a conversation: the badge and the list update.
export function conversationRead(queryClient: QueryClient, userId: string) {
  void queryClient.invalidateQueries({
    queryKey: messageKeys.unreadCount(userId),
  });
  void queryClient.invalidateQueries({ queryKey: messageKeys.list(userId) });
}
