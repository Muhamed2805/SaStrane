import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStream } from '@/features/auth/session';
import { ApiError } from '@/lib/api-client';
import { isLive } from '@/lib/live-status';
import { connectLive } from './connection';
import type { LiveEvent } from './events';

vi.mock('@/features/auth/session', () => ({ authStream: vi.fn() }));

const authStreamMock = vi.mocked(authStream);

// A stream the test writes to and ends.
function openStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  return {
    response: new Response(body),
    send: (event: object) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    end: () => controller.close(),
  };
}

// Lets the pending reads and promises run.
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('connectLive', () => {
  let events: LiveEvent[];
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('hands out the events and is live while the stream is open', async () => {
    const stream = openStream();
    authStreamMock.mockResolvedValue(stream.response);

    stop = connectLive((event) => events.push(event));
    await settle();
    expect(authStreamMock).toHaveBeenCalledWith(
      '/live',
      expect.any(AbortSignal),
    );
    expect(isLive()).toBe(false);

    stream.send({ type: 'ready' });
    stream.send({ type: 'message', conversationId: 'c-1' });
    await settle();

    expect(isLive()).toBe(true);
    expect(events).toEqual([
      { type: 'ready' },
      { type: 'message', conversationId: 'c-1' },
    ]);
  });

  it('opens a new stream when the server ends one', async () => {
    const first = openStream();
    const second = openStream();
    authStreamMock
      .mockResolvedValueOnce(first.response)
      .mockResolvedValueOnce(second.response);

    stop = connectLive((event) => events.push(event));
    await settle();
    first.send({ type: 'ready' });
    await settle();
    first.end();
    await settle();
    expect(isLive()).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    second.send({ type: 'ready' });
    await settle();

    expect(authStreamMock).toHaveBeenCalledTimes(2);
    expect(isLive()).toBe(true);
  });

  it('waits longer after each failure', async () => {
    authStreamMock.mockRejectedValue(new ApiError('down', 503));

    stop = connectLive((event) => events.push(event));
    await settle();
    expect(authStreamMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(authStreamMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(authStreamMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(authStreamMock).toHaveBeenCalledTimes(3);
  });

  it('gives up when the user is signed out', async () => {
    authStreamMock.mockRejectedValue(new ApiError('signed out', 401));

    stop = connectLive((event) => events.push(event));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(authStreamMock).toHaveBeenCalledTimes(1);
  });

  it('opens a new stream after a long silence', async () => {
    const quiet = openStream();
    authStreamMock.mockImplementation((_path, signal) => {
      // An aborted fetch ends its stream.
      signal.addEventListener('abort', () => quiet.end());
      return Promise.resolve(quiet.response);
    });

    stop = connectLive((event) => events.push(event));
    await settle();
    quiet.send({ type: 'ready' });
    await settle();
    expect(isLive()).toBe(true);

    await vi.advanceTimersByTimeAsync(45_000);
    expect(isLive()).toBe(false);
  });

  it('closes the stream and stops when asked', async () => {
    const stream = openStream();
    let signal: AbortSignal | undefined;
    authStreamMock.mockImplementation((_path, streamSignal) => {
      signal = streamSignal;
      streamSignal.addEventListener('abort', () => stream.end());
      return Promise.resolve(stream.response);
    });

    stop = connectLive((event) => events.push(event));
    await settle();
    stream.send({ type: 'ready' });
    await settle();

    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(signal?.aborted).toBe(true);
    expect(isLive()).toBe(false);
    expect(authStreamMock).toHaveBeenCalledTimes(1);
  });
});
