import { describe, expect, it } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formats a date with Bosnian month names', () => {
    expect(formatDate(new Date(2026, 8, 17))).toBe('17. septembar 2026.');
  });

  it('accepts ISO date strings', () => {
    expect(formatDate('2026-01-05T12:00:00.000Z')).toBe('5. januar 2026.');
  });
});
