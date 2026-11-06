import { describe, expect, it } from 'vitest';
import { daysLeft, expiryLabel, isExpiringSoon } from './expiry';

const now = new Date('2026-12-01T10:00:00.000Z');
const inHours = (hours: number) =>
  new Date(now.getTime() + hours * 60 * 60_000).toISOString();

describe('expiry', () => {
  it('counts whole days left, rounded up', () => {
    expect(daysLeft(inHours(-5), now)).toBe(0);
    expect(daysLeft(inHours(5), now)).toBe(1);
    expect(daysLeft(inHours(49), now)).toBe(3);
  });

  it('says when the job expires', () => {
    expect(expiryLabel(inHours(-1), now)).toBe('Ističe danas');
    expect(expiryLabel(inHours(20), now)).toBe('Ističe sutra');
    expect(expiryLabel(inHours(48), now)).toBe('Ističe za 2 dana');
    expect(expiryLabel(inHours(21 * 24), now)).toBe('Ističe za 21 dan');
    expect(expiryLabel(inHours(11 * 24), now)).toBe('Ističe za 11 dana');
  });

  it('flags open jobs within a week of expiring', () => {
    expect(
      isExpiringSoon({ status: 'OPEN', expiresAt: inHours(48) }, now),
    ).toBe(true);
    expect(
      isExpiringSoon({ status: 'OPEN', expiresAt: inHours(20 * 24) }, now),
    ).toBe(false);
    expect(
      isExpiringSoon({ status: 'CLOSED', expiresAt: inHours(48) }, now),
    ).toBe(false);
    expect(isExpiringSoon({ status: 'OPEN', expiresAt: null }, now)).toBe(
      false,
    );
  });
});
