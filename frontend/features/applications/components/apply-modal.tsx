'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  FileText,
  LoaderCircle,
  MapPin,
  Send,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { listingsApi, type ListingFromApi } from '@/features/listings/api';
import { useApplicationsStore } from '../store';

export function ApplyModal() {
  const { token } = useAuthStore();
  const {
    isApplyOpen,
    activeListingId,
    closeApply,
    submitApplication,
    hasApplied,
    isSubmitting,
    error,
  } = useApplicationsStore();

  const [listingDetails, setListingDetails] = useState<ListingFromApi | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!activeListingId) return;

    let cancelled = false;

    listingsApi
      .getById(activeListingId)
      .then((listing) => {
        if (!cancelled) setListingDetails(listing);
      })
      .catch(() => {
        if (!cancelled) setListingDetails(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeListingId]);

  useEffect(() => {
    if (!isApplyOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        setMessage('');
        setPrice('');
        closeApply();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeApply, isApplyOpen, isSubmitting]);

  const alreadyApplied = useMemo(() => {
    if (!activeListingId) return false;
    return hasApplied(activeListingId);
  }, [activeListingId, hasApplied]);

  if (!isApplyOpen || !activeListingId) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setMessage('');
    setPrice('');
    closeApply();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    await submitApplication(
      activeListingId,
      message.trim(),
      price.trim(),
      token,
    );
    if (!useApplicationsStore.getState().error) {
      setMessage('');
      setPrice('');
      toast.success('Prijava je uspješno poslana!');
    }
  };

  const currentListing =
    listingDetails?.id === activeListingId ? listingDetails : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-brand-navy/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Zatvori prijavu"
      />

      <div
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-dialog-title"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Zatvori"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <header className="border-b px-6 py-6 sm:px-8">
          <p className="text-sm font-semibold text-primary">Pošalji ponudu</p>
          <h2 id="apply-dialog-title" className="mt-1 text-2xl font-bold">
            Prijava na posao
          </h2>
          <p className="mt-2 pr-8 text-sm leading-6 text-muted-foreground">
            Predstavi se klijentu i napiši zašto si dobar izbor za ovaj posao.
          </p>
        </header>

        <div className="p-6 sm:p-8">
          <section className="rounded-xl border bg-muted/40 p-4">
            <p className="font-semibold">
              {currentListing?.title ?? `Oglas #${activeListingId}`}
            </p>
            {currentListing ? (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="size-3.5 text-primary" aria-hidden="true" />
                  {currentListing.category}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin
                    className="size-3.5 text-primary"
                    aria-hidden="true"
                  />
                  {currentListing.location}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-brand-orange-dark">
                  <Banknote className="size-3.5" aria-hidden="true" />
                  {currentListing.budget || 'Po dogovoru'}
                </span>
              </div>
            ) : null}
          </section>

          {alreadyApplied ? (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/[0.06] p-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-white">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold">Prijava je već poslana</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Status prijave možeš pratiti u sekciji „Moje prijave“.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-5 rounded-lg border bg-white px-5 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                Zatvori
              </button>
            </div>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="application-message"
                    className="text-sm font-semibold"
                  >
                    Poruka klijentu <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {message.length}/2000
                  </span>
                </div>
                <div className="relative mt-2">
                  <FileText
                    className="pointer-events-none absolute top-4 left-4 size-4 text-primary"
                    aria-hidden="true"
                  />
                  <textarea
                    id="application-message"
                    className="min-h-36 w-full resize-y rounded-lg border bg-background px-4 py-3.5 pl-11 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10"
                    placeholder="Napiši kada si dostupan, relevantno iskustvo i koliko vremena ti je potrebno..."
                    value={message}
                    minLength={10}
                    maxLength={2000}
                    required
                    autoFocus
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Najmanje 10 znakova. Ne dijeli osjetljive lične podatke.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="application-price"
                    className="text-sm font-semibold"
                  >
                    Predložena cijena{' '}
                    <span className="font-normal text-muted-foreground">
                      (opcionalno)
                    </span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {price.length}/60
                  </span>
                </div>
                <div className="relative mt-2">
                  <Banknote
                    className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                    aria-hidden="true"
                  />
                  <input
                    id="application-price"
                    className="h-12 w-full rounded-lg border bg-background pr-4 pl-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10"
                    placeholder="npr. 50 KM ili 20 KM/h"
                    value={price}
                    maxLength={60}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="h-11 rounded-lg border bg-white px-5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || message.trim().length < 10}
                >
                  {isSubmitting ? (
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {isSubmitting ? 'Šaljem prijavu...' : 'Pošalji prijavu'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
