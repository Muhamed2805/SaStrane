import { describe, expect, it } from 'vitest';
import { nextPageParam, pageItems, pageTotal } from './paging';

const page = (items: string[], pageNumber: number, total: number) => ({
  items: items.map((id) => ({ id })),
  total,
  page: pageNumber,
  totalPages: 2,
});

describe('paging', () => {
  it('stops after the last page', () => {
    expect(nextPageParam(page([], 1, 12))).toBe(2);
    expect(nextPageParam(page([], 2, 12))).toBeUndefined();
  });

  it('lists an item that moved to the next page once', () => {
    const pages = [page(['c', 'b'], 1, 3), page(['b', 'a'], 2, 4)];

    expect(pageItems(pages).map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(pageTotal(pages)).toBe(4);
    expect(pageTotal(undefined)).toBeUndefined();
  });
});
