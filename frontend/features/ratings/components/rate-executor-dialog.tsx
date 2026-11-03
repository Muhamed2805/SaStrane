'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { applicationKeys } from '@/features/applications/queries';
import { cn } from '@/lib/utils';
import { MAX_COMMENT_LENGTH, MAX_SCORE, ratingsApi } from '../api';
import { ratingGiven } from '../queries';

const SCORE_LABELS: Record<number, string> = {
  1: 'Loše',
  2: 'Slabo',
  3: 'Dobro',
  4: 'Vrlo dobro',
  5: 'Odlično',
};

const STARS = Array.from({ length: MAX_SCORE }, (_, index) => index + 1);

type RateExecutorDialogProps = {
  userId: string;
  applicationId: string;
  executor: { id: string; fullName: string };
  listingTitle?: string;
  onClose: () => void;
};

// Asks the client for 1 to 5 stars and an optional comment. A rating is
// final, so the dialog says so before it is sent.
export function RateExecutorDialog({
  userId,
  applicationId,
  executor,
  listingTitle,
  onClose,
}: RateExecutorDialogProps) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      ratingsApi.create({
        applicationId,
        score,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      ratingGiven(queryClient, userId, executor.id);
      toast.success('Hvala! Ocjena je sačuvana.');
      onClose();
    },
    onError: (error) => {
      // Rated in another tab, or the job was reopened: show the new state.
      void queryClient.invalidateQueries({
        queryKey: applicationKeys.all(userId),
      });
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
          Ocijeni izvođača
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {executor.fullName}
          {listingTitle ? ` · ${listingTitle}` : ''}
        </p>

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
              placeholder="Kako je prošao posao?"
              className="mt-2 w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {comment.length}/{MAX_COMMENT_LENGTH}
            </p>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Ocjena je javna na profilu izvođača i ne može se kasnije
            promijeniti.
          </p>

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
