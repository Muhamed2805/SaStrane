"use client";

import { FormEvent, useState } from "react";
import {
  LISTING_CATEGORIES,
  LISTING_LOCATIONS,
} from "@/features/listings/constants";

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
  onSubmit: (values: ListingFormValues) => Promise<void>;
};

const EMPTY_VALUES: ListingFormValues = {
  title: "",
  category: LISTING_CATEGORIES[0],
  location: LISTING_LOCATIONS[0],
  budget: "",
  description: "",
};

export function ListingForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  submittingLabel,
  onSubmit,
}: ListingFormProps) {
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof ListingFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Došlo je do greške.");
      setIsSubmitting(false);
    }
  };

  const isInvalid =
    !values.title.trim() || !values.category || !values.location;

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">
          Naslov
        </label>
        <input
          id="title"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="npr. Košenje trave u dvorištu"
          value={values.title}
          maxLength={120}
          required
          onChange={(event) => updateField("title", event.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="category">
          Kategorija
        </label>
        <select
          id="category"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={values.category}
          onChange={(event) => updateField("category", event.target.value)}
        >
          {LISTING_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="location">
          Lokacija
        </label>
        <select
          id="location"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={values.location}
          onChange={(event) => updateField("location", event.target.value)}
        >
          {LISTING_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="budget">
          Budžet (opcionalno)
        </label>
        <input
          id="budget"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="npr. 50 KM ili 20 KM/h"
          value={values.budget}
          maxLength={60}
          onChange={(event) => updateField("budget", event.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="description">
          Opis (opcionalno)
        </label>
        <textarea
          id="description"
          className="min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
          placeholder="Opiši posao detaljnije..."
          value={values.description}
          maxLength={2000}
          onChange={(event) => updateField("description", event.target.value)}
        />
      </div>

      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        className="h-10 w-full rounded-md bg-black text-sm text-white hover:opacity-90 disabled:opacity-50"
        disabled={isSubmitting || isInvalid}
        type="submit"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
