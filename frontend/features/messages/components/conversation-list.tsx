'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, MessageCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { formatMessageTime } from '@/lib/format-message-time';
import { pageItems } from '@/lib/paging';
import { cn } from '@/lib/utils';
import type { Conversation } from '../api';
import { conversationsQuery } from '../queries';

function ConversationRow({
  conversation,
  userId,
  isActive,
}: {
  conversation: Conversation;
  userId: string;
  isActive: boolean;
}) {
  const { otherUser, lastMessage, unreadCount } = conversation;
  const isUnread = unreadCount > 0;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted',
        isActive && 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      <UserAvatar
        name={otherUser.fullName}
        url={otherUser.avatarUrl}
        className="size-10 rounded-full bg-primary/10 text-sm font-bold text-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              isUnread ? 'font-bold' : 'font-semibold',
            )}
          >
            {otherUser.fullName}
          </span>
          {lastMessage ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatMessageTime(lastMessage.createdAt)}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-primary">
          {conversation.listing.title}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-xs',
              isUnread
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {lastMessage
              ? `${lastMessage.senderId === userId ? 'Ti: ' : ''}${lastMessage.body}`
              : 'Još nema poruka'}
          </span>
          {isUnread ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white">
              <span className="sr-only">Nepročitano: </span>
              {unreadCount}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

export function ConversationList({
  userId,
  activeId,
}: {
  userId: string;
  activeId?: string;
}) {
  const query = useInfiniteQuery(conversationsQuery(userId));
  const conversations = pageItems(query.data?.pages);

  if (query.isPending) {
    return (
      <div className="space-y-3 p-3" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.error && !query.data) {
    return (
      <div className="p-6 text-center text-sm">
        <p className="text-red-600">{query.error.message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 inline-flex items-center gap-2 font-semibold text-primary"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-bold">Još nemaš poruka</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
          Otvori oglas i pošalji poruku klijentu, ili odgovori na prijave za
          tvoje oglase.
        </p>
        <Link
          href="/listings"
          className="mt-5 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Pronađi posao
        </Link>
      </div>
    );
  }

  return (
    <nav aria-label="Razgovori" className="space-y-1 p-2">
      {conversations.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          userId={userId}
          isActive={conversation.id === activeId}
        />
      ))}
      {query.hasNextPage ? (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary disabled:opacity-50"
        >
          {query.isFetchingNextPage ? (
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : null}
          Učitaj još
        </button>
      ) : null}
    </nav>
  );
}
