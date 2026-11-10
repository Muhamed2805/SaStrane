import { authStream } from '@/features/auth/session';
import { ApiError } from '@/lib/api-client';
import { setLive } from '@/lib/live-status';
import { takeLiveEvents, type LiveEvent } from './events';

// The server pings every 15 seconds. Longer silence means a dead connection
// that the browser has not noticed.
const SILENCE_MS = 45_000;
// The server ends a stream after 10 minutes; the next one opens at once.
const REOPEN_MS = 1_000;
const MAX_RETRY_MS = 30_000;

function wait(ms: number, stopped: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      stopped.removeEventListener('abort', done);
      resolve();
    }
    stopped.addEventListener('abort', done);
  });
}

// One stream, from opening to its end. Resolves to whether it ever opened.
async function listen(
  onEvent: (event: LiveEvent) => void,
  stopped: AbortSignal,
): Promise<boolean> {
  const attempt = new AbortController();
  const abort = () => attempt.abort();
  stopped.addEventListener('abort', abort);
  let silence = setTimeout(abort, SILENCE_MS);
  let opened = false;

  try {
    const response = await authStream('/live', attempt.signal);
    const reader = response
      .body!.pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) return opened;
      clearTimeout(silence);
      silence = setTimeout(abort, SILENCE_MS);

      const taken = takeLiveEvents(buffer + value);
      buffer = taken.rest;
      for (const event of taken.events) {
        if (event.type === 'ready') {
          opened = true;
          setLive(true);
        }
        onEvent(event);
      }
    }
  } finally {
    clearTimeout(silence);
    stopped.removeEventListener('abort', abort);
    setLive(false);
  }
}

async function run(onEvent: (event: LiveEvent) => void, stopped: AbortSignal) {
  let failures = 0;
  while (!stopped.aborted) {
    try {
      failures = (await listen(onEvent, stopped)) ? 0 : failures + 1;
    } catch (error) {
      // Signed out. A new sign-in connects again.
      if (error instanceof ApiError && error.status === 401) return;
      failures += 1;
    }
    await wait(
      failures === 0
        ? REOPEN_MS
        : Math.min(MAX_RETRY_MS, 1_000 * 2 ** failures),
      stopped,
    );
  }
}

// Keeps the signed-in user's event stream open and opens it again when it
// ends or fails. Returns the function that closes it.
export function connectLive(onEvent: (event: LiveEvent) => void) {
  const stop = new AbortController();
  void run(onEvent, stop.signal);
  return () => stop.abort();
}
