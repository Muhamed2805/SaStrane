import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  totalPages: number;
  // While new results load.
  disabled?: boolean;
  // Names the navigation for screen readers.
  label: string;
  onChange: (page: number) => void;
};

// Up to five page numbers, with the current one near the middle.
export function visiblePages(page: number, totalPages: number) {
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const count = Math.min(5, totalPages);
  return Array.from({ length: count }, (_, index) => firstPage + index);
}

// Shows nothing for a single page.
export function Pagination({
  page,
  totalPages,
  disabled = false,
  label,
  onChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-3"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1 || disabled}
        className="flex size-10 items-center justify-center rounded-lg border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Prethodna stranica"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>

      {visiblePages(page, totalPages).map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          onClick={() => onChange(pageNumber)}
          disabled={disabled}
          className={`size-10 rounded-lg text-sm font-semibold transition-colors ${
            pageNumber === page
              ? 'bg-primary text-white'
              : 'border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary'
          }`}
          aria-label={`Stranica ${pageNumber}`}
          aria-current={pageNumber === page ? 'page' : undefined}
        >
          {pageNumber}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages || disabled}
        className="flex size-10 items-center justify-center rounded-lg border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Sljedeća stranica"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
