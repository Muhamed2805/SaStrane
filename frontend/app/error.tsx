'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12 sm:py-16">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-red-600">
        Neočekivana greška
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Nešto nije prošlo kako treba
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Problem je vjerovatno privremen. Pokušaj ponovo, a ako se greška nastavi
        vrati se na pregled oglasa.
      </p>
      {error.digest ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Referenca greške: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Pokušaj ponovo
        </button>
        <Link
          href="/listings"
          className="inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Nazad na oglase
        </Link>
      </div>
    </section>
  );
}
