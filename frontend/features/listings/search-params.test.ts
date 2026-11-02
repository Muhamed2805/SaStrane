import { describe, expect, it } from 'vitest';
import {
  feedRequestParams,
  listingFiltersQuery,
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
