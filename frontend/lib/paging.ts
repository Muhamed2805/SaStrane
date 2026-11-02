// Paged API lists return { items, total, page, limit, totalPages }.
type Page<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};

export const WORKSPACE_PAGE_SIZE = 10;

// For useInfiniteQuery: the next page, or undefined after the last one.
export function nextPageParam(lastPage: Page<unknown>) {
  return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
}

// The items of every loaded page. A new item shifts the later pages, so an
// item can come back on the next page: it is listed only once.
export function pageItems<T extends { id: string }>(
  pages: Page<T>[] | undefined,
): T[] {
  const seen = new Set<string>();
  return (pages ?? []).flatMap((page) =>
    page.items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  );
}

// The newest total, or undefined before the first page arrives.
export function pageTotal(pages: Page<unknown>[] | undefined) {
  return pages?.at(-1)?.total;
}
