'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  MAX_DETAILS_LENGTH,
  moderationApi,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '../api';

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

type ReportDialogProps = {
  // Exactly one of them.
  target: { listingId: string } | { userId: string };
  title: string;
  // The job title or the user's name.
  subject: string;
  onClose: () => void;
};

export function ReportDialog({
  target,
  title,
  subject,
  onClose,
}: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: (chosen: ReportReason) =>
      moderationApi.report({
        ...target,
        reason: chosen,
        details: details.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Hvala. Prijava je poslana administratorima.');
      onClose();
    },
    onError: (error) => toast.error(error.message),
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
    if (!reason || isSubmitting) return;
    mutation.mutate(reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-brand-navy/70 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Zatvori prijavu"
      />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
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

        <h2 id="report-dialog-title" className="pr-10 text-xl font-bold">
          {title}
        </h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">{subject}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold">Razlog</legend>
            <div className="mt-2 space-y-2">
              {REASONS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                    reason === value
                      ? 'border-primary bg-primary/5 font-semibold'
                      : 'hover:border-primary/30',
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="size-4 accent-primary"
                  />
                  {REPORT_REASON_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="report-details" className="text-sm font-semibold">
              Opis{' '}
              <span className="font-normal text-muted-foreground">
                (nije obavezno)
              </span>
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={MAX_DETAILS_LENGTH}
              rows={4}
              placeholder="Šta se desilo?"
              className="mt-2 w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {details.length}/{MAX_DETAILS_LENGTH}
            </p>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Prijavu vide samo administratori. Tvoje ime ostaje skriveno od
            prijavljene osobe.
          </p>

          <button
            type="submit"
            disabled={!reason || isSubmitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Pošalji prijavu
          </button>
        </form>
      </div>
    </div>
  );
}
