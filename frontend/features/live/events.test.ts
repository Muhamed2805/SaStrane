import { describe, expect, it } from 'vitest';
import { takeLiveEvents } from './events';

describe('takeLiveEvents', () => {
  it('reads whole events and keeps the unfinished rest', () => {
    expect(
      takeLiveEvents(
        'id: 1\ndata: {"type":"ready"}\n\n' +
          'id: 2\ndata: {"type":"message","conversationId":"c-1"}\n\n' +
          'id: 3\ndata: {"type":"read","conversationId":"c-2"}\n\n' +
          'id: 4\ndata: {"type":"notif',
      ),
    ).toEqual({
      events: [
        { type: 'ready' },
        { type: 'message', conversationId: 'c-1' },
        { type: 'read', conversationId: 'c-2' },
      ],
      rest: 'id: 4\ndata: {"type":"notif',
    });
  });

  it('finishes an event with the next chunk', () => {
    const first = takeLiveEvents('data: {"type":"notif');
    expect(first.events).toEqual([]);

    expect(takeLiveEvents(`${first.rest}ication"}\n\n`)).toEqual({
      events: [{ type: 'notification' }],
      rest: '',
    });
  });

  it('reads events with Windows line ends', () => {
    expect(takeLiveEvents('data: {"type":"ping"}\r\n\r\n').events).toEqual([
      { type: 'ping' },
    ]);
  });

  it('skips what it does not know', () => {
    expect(
      takeLiveEvents(
        ': comment\n\n' +
          'data: not json\n\n' +
          'data: {"type":"something-new"}\n\n' +
          'data: {"type":"message"}\n\n' +
          'data: {"type":"notification","extra":1}\n\n',
      ).events,
    ).toEqual([{ type: 'notification' }]);
  });
});
