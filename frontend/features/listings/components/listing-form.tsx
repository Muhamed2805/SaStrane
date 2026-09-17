'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  FileText,
  Lightbulb,
  ListFilter,
  LoaderCircle,
  MapPin,
  Save,
  Type,
} from 'lucide-react';
import {
  LISTING_CATEGORIES,
  LISTING_LOCATIONS,
} from '@/features/listings/constants';

export type ListingFormValues = {
  title: string;
  category: string;
  location: string;
  budget: string;
  description: string;
};

type ListingFormProps = {
  initialValues?: ListingFormValues;
  submitLabel: string;
  submittingLabel: string;
  cancelHref: string;
  onSubmit: (values: ListingFormValues) => Promise<void>;
};

const EMPTY_VALUES: ListingFormValues = {
  title: '',
  category: LISTING_CATEGORIES[0],
  location: LISTING_LOCATIONS[0],
  budget: '',
  description: '',
};

const inputClassName =
  'w-full rounded-lg border bg-background text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10';

export function ListingForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  submittingLabel,
  cancelHref,
  onSubmit,
}: ListingFormProps) {
  const [initialSnapshot] = useState(initialValues);
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = useMemo(
    () =>
      (Object.keys(values) as Array<keyof ListingFormValues>).some(
        (field) => values[field] !== initialSnapshot[field],
      ),
    [initialSnapshot, values],
  );

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSubmitting) return;
      event.preventDefault();
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [isDirty, isSubmitting]);

  const updateField = (field: keyof ListingFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: values.title.trim(),
        category: values.category,
        location: values.location,
        budget: values.budget.trim(),
        description: values.description.trim(),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Došlo je do greške.',
      );
      setIsSubmitting(false);
    }
  };

  const handleCancel = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      isDirty &&
      !window.confirm('Imaš nesačuvane izmjene. Želiš li ipak odustati?')
    ) {
      event.preventDefault();
    }
  };

  const isInvalid =
    !values.title.trim() || !values.category || !values.location;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="border-b px-6 py-5 sm:px-8">
          <h2 className="text-lg font-bold">Informacije o poslu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Polja označena zvjezdicom su obavezna.
          </p>
        </div>

        <div className="space-y-7 p-6 sm:p-8">
          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-semibold" htmlFor="title">
                Naslov oglasa <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {values.title.length}/120
              </span>
            </div>
            <div className="relative mt-2">
              <Type
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
              <input
                id="title"
                className={`${inputClassName} h-12 pr-4 pl-11`}
                placeholder="npr. Potrebna pomoć pri selidbi"
                value={values.title}
                maxLength={120}
                required
                autoFocus
                onChange={(event) => updateField('title', event.target.value)}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Kratak i konkretan naslov pomaže izvođačima da odmah razumiju
              zadatak.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold" htmlFor="category">
                Kategorija <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-2">
                <ListFilter
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                  aria-hidden="true"
                />
                <select
                  id="category"
                  className={`${inputClassName} h-12 appearance-none pr-10 pl-11`}
                  value={values.category}
                  onChange={(event) =>
                    updateField('category', event.target.value)
                  }
                >
                  {LISTING_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="location">
                Lokacija <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-2">
                <MapPin
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                  aria-hidden="true"
                />
                <select
                  id="location"
                  className={`${inputClassName} h-12 appearance-none pr-10 pl-11`}
                  value={values.location}
                  onChange={(event) =>
                    updateField('location', event.target.value)
                  }
                >
                  {LISTING_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-semibold" htmlFor="description">
                Opis posla
              </label>
              <span className="text-xs text-muted-foreground">
                {values.description.length}/2000
              </span>
            </div>
            <div className="relative mt-2">
              <FileText
                className="pointer-events-none absolute top-4 left-4 size-4 text-primary"
                aria-hidden="true"
              />
              <textarea
                id="description"
                className={`${inputClassName} min-h-44 resize-y px-4 py-3.5 pl-11 leading-6`}
                placeholder="Opiši šta treba uraditi, očekivani rok i sve važne detalje..."
                value={values.description}
                maxLength={2000}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ne dijeli broj telefona, adresu ili druge osjetljive podatke u
              javnom opisu.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-semibold" htmlFor="budget">
                Predviđeni budžet{' '}
                <span className="font-normal text-muted-foreground">
                  (opcionalno)
                </span>
              </label>
              <span className="text-xs text-muted-foreground">
                {values.budget.length}/60
              </span>
            </div>
            <div className="relative mt-2">
              <Banknote
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
              <input
                id="budget"
                className={`${inputClassName} h-12 pr-4 pl-11`}
                placeholder="npr. 50 KM, 20 KM/h ili po dogovoru"
                value={values.budget}
                maxLength={60}
                onChange={(event) => updateField('budget', event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              <p className="font-semibold">Oglas nije sačuvan</p>
              <p className="mt-1 text-red-600">{error}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t bg-muted/30 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          <Link
            href={cancelHref}
            onClick={handleCancel}
            className="inline-flex h-11 items-center justify-center rounded-lg border bg-white px-5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Odustani
          </Link>
          <button
            className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || isInvalid}
            type="submit"
          >
            {isSubmitting ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>

      <aside className="space-y-5 lg:sticky lg:top-24">
        <section className="rounded-2xl border bg-primary/[0.06] p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lightbulb className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-bold">Savjeti za bolji oglas</h2>
          <ul className="mt-4 space-y-4">
            {[
              'Jasno objasni šta treba uraditi.',
              'Navedi lokaciju i očekivani rok.',
              'Dodaj realan okvirni budžet.',
              'Odgovori izvođačima na vrijeme.',
            ].map((tip) => (
              <li
                key={tip}
                className="flex gap-2.5 text-xs leading-5 text-muted-foreground"
              >
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="font-bold">Šta slijedi?</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Nakon objave, izvođači mogu poslati poruku, predloženu cijenu i
            prijavu. Sve prijave možeš pregledati na jednom mjestu.
          </p>
        </section>
      </aside>
    </div>
  );
}
