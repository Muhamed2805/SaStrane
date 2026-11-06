'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, MessageSquareQuote, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import { pageItems } from '@/lib/paging';
import { userClientRatingsQuery, userRatingsQuery } from '../queries';
import { RatingStars } from './rating-stars';

// The reviews on a public profile that clients wrote, newest first.
export function UserRatings({ userId }: { userId: string }) {
  const query = useInfiniteQuery(userRatingsQuery(userId));
  const ratings = pageItems(query.data?.pages).map((rating) => ({
    ...rating,
    author: rating.client.fullName,
  }));

  return (
    <RatingList
      query={query}
      ratings={ratings}
      emptyText="Ocjene ostavljaju klijenti nakon završenog posla."
    />
  );
}

// The reviews on a public profile that executors wrote about the user as a
// client, newest first.
export function UserClientRatings({ userId }: { userId: string }) {
  const query = useInfiniteQuery(userClientRatingsQuery(userId));
  const ratings = pageItems(query.data?.pages).map((rating) => ({
    ...rating,
    author: rating.executor.fullName,
  }));

  return (
    <RatingList
      query={query}
      ratings={ratings}
      emptyText="Ocjene ostavljaju izvođači nakon završenog posla."
    />
  );
}

type ListedRating = {
  id: string;
  score: number;
  comment: string | null;
  listingId: string | null;
  listingTitle: string;
  author: string;
  createdAt: string;
};

type RatingListProps = {
  query: {
    error: Error | null;
    isPending: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    data: unknown;
    refetch: () => Promise<unknown>;
    fetchNextPage: () => Promise<unknown>;
  };
  ratings: ListedRating[];
  emptyText: string;
};

function RatingList({ query, ratings, emptyText }: RatingListProps) {
  if (query.error && !query.data) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center text-sm shadow-sm">
        <p className="text-red-600" role="alert">
          {query.error.message}
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 inline-flex items-center gap-2 font-semibold text-primary"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground shadow-sm">
        Učitavam ocjene...
      </div>
    );
  }

  if (ratings.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-12 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageSquareQuote className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-4 font-semibold">Još nema ocjena</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {ratings.map((rating) => (
          <li
            key={rating.id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <RatingStars score={rating.score} />
              <time
                dateTime={rating.createdAt}
                className="text-xs text-muted-foreground"
              >
                {formatDate(rating.createdAt)}
              </time>
            </div>
            {rating.comment ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/85">
                {rating.comment}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              {rating.author} ·{' '}
              {rating.listingId ? (
                <Link
                  href={`/listings/${rating.listingId}`}
                  className="text-primary hover:underline"
                >
                  {rating.listingTitle}
                </Link>
              ) : (
                rating.listingTitle
              )}
            </p>
          </li>
        ))}
      </ul>
      {query.hasNextPage ? (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="flex w-full items-center justify-center gap-2 rounded-xl border bg-white py-3 text-sm font-semibold text-muted-foreground hover:text-primary disabled:opacity-50"
        >
          {query.isFetchingNextPage ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Učitaj još ocjena
        </button>
      ) : null}
    </div>
  );
}
