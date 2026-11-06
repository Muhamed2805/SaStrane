'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MAX_COMMENT_LENGTH, MAX_SCORE } from '../api';

const SCORE_LABELS: Record<number, string> = {
  1: 'Loše',
  2: 'Slabo',
  3: 'Dobro',
  4: 'Vrlo dobro',
  5: 'Odlično',
};

const STARS = Array.from({ length: MAX_SCORE }, (_, index) => index + 1);

export type RatingInput = { score: number; comment?: string };

type RateDialogProps = {
  title: string;
  subtitle?: string;
  placeholder: string;
  /** Where the rating shows, said before it is sent. */
  note: string;
  send: (input: RatingInput) => Promise<unknown>;
  onRated: () => void;
  /** Rated in another tab, or the job was reopened: show the new state. */
  onFailed: () => void;
  onClose: () => void;
};

// Asks for 1 to 5 stars and an optional comment. A rating is final, so the
// dialog says so before it is sent.
export function RateDialog({
  title,
  subtitle,
  placeholder,
  note,
  send,
  onRated,
  onFailed,
  onClose,
}: RateDialogProps) {
  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => send({ score, comment: comment.trim() || undefined }),
    onSuccess: () => {
      onRated();
      toast.success('Hvala! Ocjena je sačuvana.');
      onClose();
    },
    onError: (error) => {
      onFailed();
      toast.error(error.message);
    },
  });
  const isSubmitting = mutation.isPending;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (score === 0 || isSubmitting) return;
    mutation.mutate();
  };

  const shown = hovered || score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-brand-navy/70 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Zatvori ocjenjivanje"
      />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-dialog-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Zatvori"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <h2 id="rate-dialog-title" className="pr-10 text-xl font-bold">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold">Ocjena</legend>
            <div
              className="mt-2 flex items-center gap-1"
              role="radiogroup"
              aria-label="Broj zvjezdica"
              onMouseLeave={() => setHovered(0)}
            >
              {STARS.map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={score === star}
                  aria-label={`${star} od ${MAX_SCORE}: ${SCORE_LABELS[star]}`}
                  onClick={() => setScore(star)}
                  onMouseEnter={() => setHovered(star)}
                  className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Star
                    className={cn(
                      'size-8',
                      star <= shown
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-transparent text-muted-foreground/40',
                    )}
                    aria-hidden="true"
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {shown ? SCORE_LABELS[shown] : 'Izaberi ocjenu'}
              </span>
            </div>
          </fieldset>

          <div>
            <label htmlFor="rating-comment" className="text-sm font-semibold">
              Komentar{' '}
              <span className="font-normal text-muted-foreground">
                (nije obavezno)
              </span>
            </label>
            <textarea
              id="rating-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={4}
              placeholder={placeholder}
              className="mt-2 w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {comment.length}/{MAX_COMMENT_LENGTH}
            </p>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">{note}</p>

          <button
            type="submit"
            disabled={score === 0 || isSubmitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Sačuvaj ocjenu
          </button>
        </form>
      </div>
    </div>
  );
}
