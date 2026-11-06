import { describe, expect, it } from 'vitest';
import {
  completedJobsLabel,
  formatAverage,
  ratingCountLabel,
  responseTimeLabel,
} from './format';

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

describe('completedJobsLabel', () => {
  it.each([
    [1, '1 završen posao'],
    [2, '2 završena posla'],
    [4, '4 završena posla'],
    [5, '5 završenih poslova'],
    [11, '11 završenih poslova'],
    [13, '13 završenih poslova'],
    [21, '21 završen posao'],
    [22, '22 završena posla'],
  ])('%i jobs', (count, label) => {
    expect(completedJobsLabel(count)).toBe(label);
  });
});

describe('responseTimeLabel', () => {
  it.each([
    [1, 'Obično odgovara u roku od sat vremena'],
    [60, 'Obično odgovara u roku od sat vremena'],
    [61, 'Obično odgovara u roku od nekoliko sati'],
    [360, 'Obično odgovara u roku od nekoliko sati'],
    [361, 'Obično odgovara u roku od jednog dana'],
    [1440, 'Obično odgovara u roku od jednog dana'],
    [1441, 'Obično odgovara za više od jednog dana'],
  ])('%i minutes', (minutes, label) => {
    expect(responseTimeLabel(minutes)).toBe(label);
  });
});
