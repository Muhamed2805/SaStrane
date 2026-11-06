import { describe, expect, it } from 'vitest';
import {
  executorFiltersQuery,
  executorsFoundLabel,
  executorsRequestParams,
  parseExecutorFilters,
} from './search-params';

describe('parseExecutorFilters', () => {
  it('reads the search, filters and page', () => {
    expect(
      parseExecutorFilters(
        new URLSearchParams('q=+kombi+&skill=MOVING&location=TUZLA&page=3'),
      ),
    ).toEqual({ q: 'kombi', skill: 'MOVING', location: 'TUZLA', page: 3 });
  });

  it('drops values the API would reject', () => {
    expect(
      parseExecutorFilters({ skill: 'FLYING', location: 'LONDON', page: '0' }),
    ).toEqual({ q: '', skill: undefined, location: undefined, page: 1 });
  });

  it('takes the first of repeated values', () => {
    expect(parseExecutorFilters({ skill: ['IT_HELP', 'MOVING'] }).skill).toBe(
      'IT_HELP',
    );
  });
});

describe('executorFiltersQuery', () => {
  it('leaves out the defaults', () => {
    expect(executorFiltersQuery({ q: '', page: 1 })).toBe('');
    expect(executorFiltersQuery({ q: 'kombi', skill: 'MOVING', page: 2 })).toBe(
      'q=kombi&skill=MOVING&page=2',
    );
  });
});

describe('executorsRequestParams', () => {
  it('asks for one page of twelve', () => {
    expect(
      executorsRequestParams({ q: '', location: 'MOSTAR', page: 2 }),
    ).toEqual({
      page: 2,
      limit: 12,
      q: undefined,
      skill: undefined,
      location: 'MOSTAR',
    });
  });
});

describe('executorsFoundLabel', () => {
  it.each([
    [0, 'Pronađeno 0 izvođača'],
    [1, 'Pronađen 1 izvođač'],
    [3, 'Pronađena 3 izvođača'],
    [5, 'Pronađeno 5 izvođača'],
    [11, 'Pronađeno 11 izvođača'],
    [13, 'Pronađeno 13 izvođača'],
    [21, 'Pronađen 21 izvođač'],
    [22, 'Pronađena 22 izvođača'],
  ])('%i', (total, label) => {
    expect(executorsFoundLabel(total)).toBe(label);
  });
});
