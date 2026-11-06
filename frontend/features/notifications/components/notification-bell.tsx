'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMessageTime } from '@/lib/format-message-time';
import { pageItems } from '@/lib/paging';
import type { Notification } from '../api';
import { notificationContent } from '../content';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadNotifications,
} from '../hooks';
import { notificationsQuery } from '../queries';

function NotificationItem({
  notification,
  userId,
  onOpen,
}: {
  notification: Notification;
  userId: string;
  onOpen: (notification: Notification) => void;
}) {
  const { title, href } = notificationContent(notification, userId);
  const unread = notification.readAt === null;

  return (
    <li>
      <Link
        href={href}
        onClick={() => onOpen(notification)}
        className={`flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted ${unread ? 'bg-primary/5' : ''}`}
      >
        <span
          className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? 'bg-brand-orange' : 'bg-transparent'}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm ${unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}
          >
            {title}
            {unread ? <span className="sr-only"> (nepročitano)</span> : null}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
            „{notification.listingTitle}”
            {/* Notices from the site itself have no other user. */}
            {notification.actorName ? ` · ${notification.actorName}` : null}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {formatMessageTime(notification.createdAt)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function NotificationList({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const query = useInfiniteQuery(notificationsQuery(userId));
  const markRead = useMarkNotificationRead(userId);
  const items = pageItems(query.data?.pages);

  const open = (notification: Notification) => {
    if (notification.readAt === null) markRead(notification.id);
    onClose();
  };

  if (query.isPending) {
    return (
      <div className="space-y-2 p-2" aria-label="Učitavanje obavijesti">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Obavijesti se nisu učitale.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 text-sm font-semibold text-primary hover:underline"
        >
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <Bell className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-semibold">Još nema obavijesti</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ovdje stižu pozivi, prijave na tvoje oglase, odluke i ocjene.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">
      <ul className="space-y-1">
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            userId={userId}
            onOpen={open}
          />
        ))}
      </ul>
      {query.hasNextPage ? (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mt-1 w-full rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-muted disabled:opacity-60"
        >
          {query.isFetchingNextPage ? 'Učitavanje…' : 'Prikaži starije'}
        </button>
      ) : null}
    </div>
  );
}

// The bell in the navbar: the number of unread notifications and, when
// open, the newest ones.
export function NotificationBell({ userId }: { userId: string }) {
  const unread = useUnreadNotifications() ?? 0;
  const { markAllRead, isMarking } = useMarkAllNotificationsRead(userId);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const label =
    unread > 0 ? `Obavijesti, ${unread} nepročitanih` : 'Obavijesti';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label="Obavijesti"
          className="fixed inset-x-4 top-[4.5rem] z-50 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.75rem)] sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Obavijesti</h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                disabled={isMarking}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
              >
                <CheckCheck className="size-4" />
                Označi sve kao pročitano
              </button>
            ) : null}
          </div>
          <NotificationList userId={userId} onClose={() => setIsOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
