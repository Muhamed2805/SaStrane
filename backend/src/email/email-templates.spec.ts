import { describe, expect, it } from 'vitest';
import { formatPrice, unreadMessagesText } from './email-templates.js';

describe('email templates', () => {
  it.each([
    [1, '1 nepročitana poruka'],
    [2, '2 nepročitane poruke'],
    [4, '4 nepročitane poruke'],
    [5, '5 nepročitanih poruka'],
    [11, '11 nepročitanih poruka'],
    [12, '12 nepročitanih poruka'],
    [21, '21 nepročitana poruka'],
    [22, '22 nepročitane poruke'],
    [111, '111 nepročitanih poruka'],
  ])('counts %i unread messages in Bosnian', (count, text) => {
    expect(unreadMessagesText(count)).toBe(text);
  });

  it('formats prices as on the site', () => {
    expect(formatPrice(40)).toBe('40 KM');
    expect(formatPrice(1500)).toBe('1.500 KM');
    expect(formatPrice(1250000)).toBe('1.250.000 KM');
    expect(formatPrice(null)).toBe('po dogovoru');
  });
});
