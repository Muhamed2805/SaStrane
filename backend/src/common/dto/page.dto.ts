// The paging fields of every list response. Each list adds its own items.
export class PageDto {
  /** The number of items on all pages together. */
  total!: number;

  /** The current page, starting at 1. */
  page!: number;

  /** The maximum number of items per page. */
  limit!: number;

  /** The number of pages, 0 when there are no items. */
  totalPages!: number;
}
