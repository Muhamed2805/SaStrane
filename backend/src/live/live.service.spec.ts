import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_MS,
  LiveService,
  MAX_STREAMS_PER_USER,
  STREAM_MAX_MS,
  type LiveEvent,
} from './live.service.js';

describe('LiveService', () => {
  let service: LiveService;

  // Opens a stream and collects what it hears.
  function listen(userId: string) {
    const events: LiveEvent[] = [];
    const state = { ended: false };
    const subscription = service.open(userId).subscribe({
      next: (event) => events.push(event),
      complete: () => {
        state.ended = true;
      },
    });
    return { events, state, close: () => subscription.unsubscribe() };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LiveService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says that the stream is open, then sends the user’s events', () => {
    const stream = listen('user-1');

    service.emit('user-1', { type: 'message', conversationId: 'c-1' });
    service.emit('user-1', { type: 'notification' });

    expect(stream.events).toEqual([
      { type: 'ready' },
      { type: 'message', conversationId: 'c-1' },
      { type: 'notification' },
    ]);
  });

  it('tells every tab of the user and nobody else', () => {
    const first = listen('user-1');
    const second = listen('user-1');
    const other = listen('user-2');

    service.emit('user-1', { type: 'notification' });

    expect(first.events).toHaveLength(2);
    expect(second.events).toHaveLength(2);
    expect(other.events).toEqual([{ type: 'ready' }]);
  });

  it('does nothing for a user without a stream', () => {
    expect(() =>
      service.emit('nobody', { type: 'notification' }),
    ).not.toThrow();
  });

  it('stops sending to a closed stream', () => {
    const stream = listen('user-1');
    stream.close();

    service.emit('user-1', { type: 'notification' });
    vi.advanceTimersByTime(HEARTBEAT_MS);

    expect(stream.events).toEqual([{ type: 'ready' }]);
  });

  it('keeps a quiet stream alive with pings', () => {
    const stream = listen('user-1');

    vi.advanceTimersByTime(HEARTBEAT_MS * 2);

    expect(stream.events).toEqual([
      { type: 'ready' },
      { type: 'ping' },
      { type: 'ping' },
    ]);
  });

  it('ends a stream after its longest life', () => {
    const stream = listen('user-1');

    vi.advanceTimersByTime(STREAM_MAX_MS);
    expect(stream.state.ended).toBe(true);

    const count = stream.events.length;
    service.emit('user-1', { type: 'notification' });
    expect(stream.events).toHaveLength(count);
  });

  it('ends the oldest stream when a user opens one too many', () => {
    const streams = Array.from({ length: MAX_STREAMS_PER_USER + 1 }, () =>
      listen('user-1'),
    );

    expect(streams.map((stream) => stream.state.ended)).toEqual([
      true,
      ...Array.from({ length: MAX_STREAMS_PER_USER }, () => false),
    ]);

    service.emit('user-1', { type: 'notification' });
    expect(streams[0].events).toEqual([{ type: 'ready' }]);
    expect(streams[1].events).toHaveLength(2);
  });

  it('ends every stream when the server stops', () => {
    const first = listen('user-1');
    const second = listen('user-2');

    service.onModuleDestroy();

    expect(first.state.ended).toBe(true);
    expect(second.state.ended).toBe(true);
  });
});
