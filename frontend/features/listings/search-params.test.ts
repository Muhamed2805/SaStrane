import { describe, expect, it } from 'vitest';
import {
  budgetRange,
  feedRequestParams,
  listingFiltersQuery,
  parseBudget,
  parseListingFilters,
} from './search-params';

describe('parseListingFilters', () => {
  it('reads the same filters from the browser and the server', () => {
    const expected = {
      q: 'trava',
      category: 'LAWN_MOWING',
      location: 'ILIDZA',
      page: 2,
    };

    expect(
      parseListingFilters(
        new URLSearchParams(
          'q=+trava+&category=LAWN_MOWING&location=ILIDZA&page=2',
        ),
      ),
    ).toEqual(expected);
    expect(
      parseListingFilters({
        q: ' trava ',
        category: 'LAWN_MOWING',
        location: ['ILIDZA', 'MOSTAR'],
        page: '2',
      }),
    ).toEqual(expected);
  });

  it('turns off values the API would reject', () => {
    expect(
      parseListingFilters(
        new URLSearchParams('category=Selidbe&location=Beograd&page=-3'),
      ),
    ).toEqual({ q: '', category: undefined, location: undefined, page: 1 });
    expect(parseListingFilters({ page: '1.5' }).page).toBe(1);
  });
});

describe('budget and sort', () => {
  it('reads the budget range and the sort', () => {
    expect(
      parseListingFilters(
        new URLSearchParams('minBudget=50&maxBudget=200&sort=BUDGET_HIGH'),
      ),
    ).toMatchObject({ minBudget: 50, maxBudget: 200, sort: 'BUDGET_HIGH' });
  });

  it('swaps a reversed range and drops values the API would reject', () => {
    expect(
      parseListingFilters(new URLSearchParams('minBudget=300&maxBudget=50')),
    ).toMatchObject({ minBudget: 50, maxBudget: 300 });
    expect(
      parseListingFilters(
        new URLSearchParams('minBudget=-5&maxBudget=100001&sort=NEWEST'),
      ),
    ).toMatchObject({
      minBudget: undefined,
      maxBudget: undefined,
      sort: undefined,
    });
    expect(parseBudget(' 80 ')).toBe(80);
    expect(parseBudget('1.5')).toBeUndefined();
    expect(parseBudget('')).toBeUndefined();
    expect(budgetRange(undefined, 0)).toEqual({
      minBudget: undefined,
      maxBudget: 0,
    });
  });

  it('writes them to the URL and the request', () => {
    const filters = {
      q: '',
      minBudget: 0,
      maxBudget: 150,
      sort: 'BUDGET_LOW' as const,
      page: 1,
    };
    expect(listingFiltersQuery(filters)).toBe(
      'minBudget=0&maxBudget=150&sort=BUDGET_LOW',
    );
    expect(feedRequestParams(filters)).toMatchObject({
      minBudget: 0,
      maxBudget: 150,
      sort: 'BUDGET_LOW',
    });
  });
});

describe('listingFiltersQuery', () => {
  it('leaves the defaults out of the URL', () => {
    expect(listingFiltersQuery({ q: '', page: 1 })).toBe('');
    expect(
      listingFiltersQuery({ q: 'pranje', category: 'CAR_WASH', page: 3 }),
    ).toBe('q=pranje&category=CAR_WASH&page=3');
  });
});

describe('feedRequestParams', () => {
  it('asks for one page of open jobs', () => {
    expect(feedRequestParams({ q: '', location: 'TUZLA', page: 2 })).toEqual({
      page: 2,
      limit: 9,
      status: 'OPEN',
      q: undefined,
      category: undefined,
      location: 'TUZLA',
    });
  });
});
