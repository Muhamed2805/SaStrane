import { describe, expect, it } from 'vitest';
import {
  formatClockTime,
  formatMessageDay,
  formatMessageTime,
  isSameDay,
} from './format-message-time';

const now = new Date(2026, 10, 2, 15, 30);

describe('formatMessageTime', () => {
  it('shows the time for a message from today', () => {
    expect(formatMessageTime(new Date(2026, 10, 2, 9, 5), now)).toBe('9:05');
  });

  it('says jučer for a message from yesterday, even late at night', () => {
    expect(formatMessageTime(new Date(2026, 10, 1, 23, 59), now)).toBe('jučer');
  });

  it('shows a short date this year and adds the year before', () => {
    expect(formatMessageTime(new Date(2026, 9, 28, 12), now)).toBe('28. okt');
    expect(formatMessageTime(new Date(2025, 11, 31, 12), now)).toBe(
      '31. dec 2025.',
    );
  });
});

describe('formatMessageDay', () => {
  it('names today and yesterday, and spells out older days', () => {
    expect(formatMessageDay(new Date(2026, 10, 2, 1), now)).toBe('Danas');
    expect(formatMessageDay(new Date(2026, 10, 1, 1), now)).toBe('Jučer');
    expect(formatMessageDay(new Date(2026, 9, 30, 1), now)).toBe(
      '30. oktobar 2026.',
    );
  });
});

describe('formatClockTime', () => {
  it('pads the minutes', () => {
    expect(formatClockTime(new Date(2026, 10, 2, 14, 7))).toBe('14:07');
  });
});

describe('isSameDay', () => {
  it('compares calendar days, not 24-hour spans', () => {
    expect(
      isSameDay(new Date(2026, 10, 2, 0, 1), new Date(2026, 10, 2, 23, 59)),
    ).toBe(true);
    expect(
      isSameDay(new Date(2026, 10, 1, 23, 59), new Date(2026, 10, 2, 0, 1)),
    ).toBe(false);
  });
});
