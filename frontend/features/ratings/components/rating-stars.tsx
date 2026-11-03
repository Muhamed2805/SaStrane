import Link from 'next/link';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_SCORE, type RatingSummary as Summary } from '../api';
import { formatAverage, ratingCountLabel } from '../format';

const STARS = Array.from({ length: MAX_SCORE }, (_, index) => index + 1);

// Five stars with the first `score` filled.
export function RatingStars({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const filled = Math.round(score);

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      <span className="sr-only">
        Ocjena {score} od {MAX_SCORE}
      </span>
      {STARS.map((star) => (
        <Star
          key={star}
          className={cn(
            'size-3.5',
            star <= filled
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-muted-foreground/40',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// "★ 4,7 · 3 ocjene", or a note that there are none yet. With `href` it
// links to the profile with the reviews.
export function RatingSummary({
  rating,
  href,
  className,
}: {
  rating: Summary;
  href?: string;
  className?: string;
}) {
  const content =
    rating.average === null ? (
      <span className="text-muted-foreground">Još nema ocjena</span>
    ) : (
      <>
        <Star
          className="size-3.5 fill-amber-400 text-amber-400"
          aria-hidden="true"
        />
        <span className="font-semibold text-foreground">
          {formatAverage(rating.average)}
        </span>
        <span className="text-muted-foreground">
          · {ratingCountLabel(rating.count)}
        </span>
      </>
    );
  const classes = cn('inline-flex items-center gap-1 text-xs', className);

  return href ? (
    <Link href={href} className={cn(classes, 'hover:underline')}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
