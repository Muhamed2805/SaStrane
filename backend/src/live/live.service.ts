import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';

// What a signed-in browser hears while it is open. An event carries no
// content: it only says what to load again, through the usual endpoints.
export type LiveEvent =
  // The stream is open.
  | { type: 'ready' }
  // Keeps proxies from closing a quiet stream.
  | { type: 'ping' }
  // A new message in this conversation, from the other side or from the
  // user in another tab.
  | { type: 'message'; conversationId: string }
  // The user read this conversation, here or in another tab.
  | { type: 'read'; conversationId: string }
  // The user has a new notification.
  | { type: 'notification' };

export const HEARTBEAT_MS = 15_000;
// A stream ends after this long and the browser opens a new one. The new
// request passes the sign-in check again, so a stream outlives a sign-out
// or a suspension by this much at most.
export const STREAM_MAX_MS = 10 * 60_000;
// Tabs of one user. A sixth stream ends the oldest.
export const MAX_STREAMS_PER_USER = 5;

// The streams live in this process. With several backend instances, a user
// hears only the events of the instance their stream is on, and the
// frontend's slow polling brings the rest.
@Injectable()
export class LiveService implements OnModuleDestroy {
  private readonly streams = new Map<string, Subscriber<LiveEvent>[]>();

  // The user's events, from now on.
  open(userId: string): Observable<LiveEvent> {
    return new Observable<LiveEvent>((subscriber) => {
      const streams = this.streams.get(userId) ?? [];
      this.streams.set(userId, streams);
      streams.push(subscriber);
      if (streams.length > MAX_STREAMS_PER_USER) streams[0].complete();

      subscriber.next({ type: 'ready' });
      const heartbeat = setInterval(
        () => subscriber.next({ type: 'ping' }),
        HEARTBEAT_MS,
      );
      const end = setTimeout(() => subscriber.complete(), STREAM_MAX_MS);

      return () => {
        clearInterval(heartbeat);
        clearTimeout(end);
        const index = streams.indexOf(subscriber);
        if (index !== -1) streams.splice(index, 1);
        if (streams.length === 0 && this.streams.get(userId) === streams) {
          this.streams.delete(userId);
        }
      };
    });
  }

  // Tells every open tab of the user. Does nothing when there is none.
  emit(userId: string, event: LiveEvent) {
    for (const subscriber of [...(this.streams.get(userId) ?? [])]) {
      subscriber.next(event);
    }
  }

  // Open streams would keep the server from stopping.
  onModuleDestroy() {
    for (const streams of [...this.streams.values()]) {
      for (const subscriber of [...streams]) subscriber.complete();
    }
  }
}
