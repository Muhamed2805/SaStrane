'use client';

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ArrowLeft, LoaderCircle, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ClosedBadge } from '@/features/listings/components/closed-badge';
import {
  formatClockTime,
  formatMessageDay,
  isSameDay,
} from '@/lib/format-message-time';
import { cn } from '@/lib/utils';
import { MAX_MESSAGE_LENGTH, messagesApi, type Message } from '../api';
import {
  conversationQuery,
  conversationRead,
  messageSent,
  messagesQuery,
  threadMessages,
} from '../queries';

// Closer to the bottom than this counts as reading the newest messages.
const BOTTOM_THRESHOLD_PX = 120;

function MessageComposer({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const body = text.trim();

  const mutation = useMutation({
    mutationFn: (messageBody: string) =>
      messagesApi.send(conversationId, messageBody),
    onSuccess: (message) => {
      messageSent(queryClient, userId, conversationId, message);
      setText('');
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!body || mutation.isPending) return;
    mutation.mutate(body);
  };

  // Enter sends, Shift+Enter starts a new line.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
      <label htmlFor="message-body" className="sr-only">
        Poruka
      </label>
      <textarea
        id="message-body"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={1}
        placeholder="Napiši poruku..."
        className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-xl border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <button
        type="submit"
        disabled={!body || mutation.isPending}
        aria-label="Pošalji poruku"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        {mutation.isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <SendHorizontal className="size-4" aria-hidden="true" />
        )}
      </button>
    </form>
  );
}

function MessageBubble({
  message,
  isMine,
}: {
  message: Message;
  isMine: boolean;
}) {
  return (
    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6 sm:max-w-[70%]',
          isMine
            ? 'rounded-br-md bg-primary text-white'
            : 'rounded-bl-md bg-muted text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            'mt-0.5 text-right text-[11px]',
            isMine ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          <time dateTime={message.createdAt}>
            {formatClockTime(message.createdAt)}
          </time>
        </p>
      </div>
    </div>
  );
}

export function ConversationThread({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const conversation = useQuery(conversationQuery(userId, conversationId));
  const messages = useInfiniteQuery(messagesQuery(userId, conversationId));
  const items = threadMessages(messages.data?.pages);
  const newest = items.at(-1);
  const pageCount = messages.data?.pages.length ?? 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrolledToId = useRef<string | null>(null);
  // Distance from the bottom before older messages were added on top.
  const keepFromBottomRef = useRef<number | null>(null);
  const markedReadId = useRef<string | null>(null);

  // A new message scrolls into view when the user sent it or was already
  // reading the newest messages.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !newest || scrolledToId.current === newest.id) return;
    const isFirst = scrolledToId.current === null;
    scrolledToId.current = newest.id;
    if (isFirst || newest.senderId === userId || isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [newest, userId]);

  // Older messages appear above without moving what the user is reading.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const fromBottom = keepFromBottomRef.current;
    if (!container || fromBottom === null) return;
    container.scrollTop = container.scrollHeight - fromBottom;
    keepFromBottomRef.current = null;
  }, [pageCount]);

  // Opening the conversation, or a new message in it, marks it as read.
  useEffect(() => {
    if (!newest || newest.senderId === userId) return;
    if (markedReadId.current === newest.id) return;
    markedReadId.current = newest.id;
    messagesApi
      .markRead(conversationId)
      .then(() => conversationRead(queryClient, userId))
      .catch(() => {
        // The next new message tries again.
        markedReadId.current = null;
      });
  }, [conversationId, newest, queryClient, userId]);

  const loadOlder = () => {
    const container = scrollRef.current;
    if (container) {
      keepFromBottomRef.current = container.scrollHeight - container.scrollTop;
    }
    void messages.fetchNextPage();
  };

  const error = conversation.error ?? (messages.data ? null : messages.error);
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <h2 className="font-bold">Razgovor nije dostupan</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link
          href="/messages"
          className="mt-4 text-sm font-semibold text-primary"
        >
          Nazad na poruke
        </Link>
      </div>
    );
  }

  const details = conversation.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          href="/messages"
          aria-label="Nazad na poruke"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        {details ? (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {details.otherUser.fullName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold">
                {details.otherUser.fullName}
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href={`/listings/${details.listing.id}`}
                  className="truncate text-xs text-primary hover:underline"
                >
                  {details.listing.title}
                </Link>
                <ClosedBadge status={details.listing.status} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const container = event.currentTarget;
          isAtBottomRef.current =
            container.scrollHeight -
              container.scrollTop -
              container.clientHeight <
            BOTTOM_THRESHOLD_PX;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-busy={messages.isPending}
      >
        {messages.hasNextPage ? (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={loadOlder}
              disabled={messages.isFetchingNextPage}
              className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary disabled:opacity-50"
            >
              {messages.isFetchingNextPage ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Starije poruke
            </button>
          </div>
        ) : null}

        {messages.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
            <Skeleton className="h-10 w-3/5 rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {details
              ? `Još nema poruka. Napiši prvu poruku za ${details.otherUser.fullName}.`
              : 'Još nema poruka.'}
          </p>
        ) : (
          items.map((message, index) => {
            const previous = items[index - 1];
            const startsDay =
              !previous || !isSameDay(previous.createdAt, message.createdAt);
            return (
              <Fragment key={message.id}>
                {startsDay ? (
                  <p className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatMessageDay(message.createdAt)}
                  </p>
                ) : null}
                <MessageBubble
                  message={message}
                  isMine={message.senderId === userId}
                />
              </Fragment>
            );
          })
        )}
      </div>

      <MessageComposer userId={userId} conversationId={conversationId} />
    </div>
  );
}
