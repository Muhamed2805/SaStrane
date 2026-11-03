import { describe, expect, it } from 'vitest';
import { formatAverage, ratingCountLabel } from './format';

describe('formatAverage', () => {
  it('shows one decimal with a comma', () => {
    expect(formatAverage(4.666)).toBe('4,7');
    expect(formatAverage(5)).toBe('5,0');
  });
});

describe('ratingCountLabel', () => {
  it.each([
    [1, '1 ocjena'],
    [2, '2 ocjene'],
    [4, '4 ocjene'],
    [5, '5 ocjena'],
    [11, '11 ocjena'],
    [12, '12 ocjena'],
    [14, '14 ocjena'],
    [21, '21 ocjena'],
    [22, '22 ocjene'],
    [0, '0 ocjena'],
  ])('%i -> %s', (count, label) => {
    expect(ratingCountLabel(count)).toBe(label);
  });
});
