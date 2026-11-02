import { describe, expect, it } from 'vitest';
import { formatPrice, parsePrice } from './format-price';

describe('formatPrice', () => {
  it('shows whole KM with a dot between thousands', () => {
    expect(formatPrice(45)).toBe('45 KM');
    expect(formatPrice(1500)).toBe('1.500 KM');
    expect(formatPrice(100000)).toBe('100.000 KM');
  });

  it('shows a missing price as agreed later', () => {
    expect(formatPrice(null)).toBe('Po dogovoru');
    expect(formatPrice(undefined)).toBe('Po dogovoru');
  });
});

describe('parsePrice', () => {
  it('reads a number and treats an empty field as no price', () => {
    expect(parsePrice(' 80 ')).toBe(80);
    expect(parsePrice('')).toBeNull();
  });
});
