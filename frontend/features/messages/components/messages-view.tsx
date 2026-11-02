'use client';

import { LockKeyhole, MessageCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/features/auth/store';
import { cn } from '@/lib/utils';
import { ConversationList } from './conversation-list';
import { ConversationThread } from './conversation-thread';

// The list and the open conversation side by side. On small screens only
// one of them shows: the list at /messages, the conversation at its URL.
export function MessagesView({ conversationId }: { conversationId?: string }) {
  const { user, status, openAuthModal } = useAuthStore();

  if (status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">Prijavi se za nastavak</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Poruke su dostupne nakon prijave na SaStrane račun.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          onClick={openAuthModal}
        >
          Prijavi se
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1
        className={cn('text-2xl font-bold', conversationId && 'max-lg:sr-only')}
      >
        Poruke
      </h1>
      <div className="grid h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-[20rem_1fr]">
        <aside
          className={cn(
            'min-h-0 overflow-y-auto border-r',
            conversationId && 'max-lg:hidden',
          )}
        >
          <ConversationList userId={user.id} activeId={conversationId} />
        </aside>
        <section
          className={cn(
            'flex min-h-0 flex-col',
            !conversationId && 'max-lg:hidden',
          )}
        >
          {conversationId ? (
            <ConversationThread
              // A new conversation starts with fresh scroll and read state.
              key={conversationId}
              userId={user.id}
              conversationId={conversationId}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageCircle className="size-8" aria-hidden="true" />
              <p className="mt-3 text-sm">Izaberi razgovor sa lijeve strane.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
