// What the server's event stream (GET /api/live) says. An event carries no
// content: it tells which data to load again.
export type LiveEvent =
  | { type: 'ready' }
  | { type: 'ping' }
  | { type: 'message'; conversationId: string }
  | { type: 'read'; conversationId: string }
  | { type: 'notification' };

function parseEvent(block: string): LiveEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;

  try {
    const event = JSON.parse(data) as {
      type?: unknown;
      conversationId?: unknown;
    };
    switch (event.type) {
      case 'ready':
      case 'ping':
      case 'notification':
        return { type: event.type };
      case 'message':
      case 'read':
        return typeof event.conversationId === 'string'
          ? { type: event.type, conversationId: event.conversationId }
          : null;
      default:
        // An event of a newer server.
        return null;
    }
  } catch {
    return null;
  }
}

// Splits what has arrived into whole events and the unfinished rest.
export function takeLiveEvents(received: string): {
  events: LiveEvent[];
  rest: string;
} {
  const blocks = received.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  return {
    events: blocks.flatMap((block) => parseEvent(block) ?? []),
    rest,
  };
}
