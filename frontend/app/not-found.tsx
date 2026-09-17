import Link from 'next/link';
import { ArrowRight, House, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center sm:py-20">
      <div className="relative">
        <span className="text-8xl font-black tracking-tighter text-primary/10 sm:text-9xl">
          404
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <SearchX className="size-7" aria-hidden="true" />
          </span>
        </span>
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        Ova stranica nije pronađena
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Adresa možda nije ispravna ili je sadržaj u međuvremenu uklonjen. Možeš
        nastaviti pregledati dostupne poslove.
      </p>
      <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/listings"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Pregledaj oglase
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
        >
          <House className="size-4" aria-hidden="true" />
          Početna stranica
        </Link>
      </div>
    </section>
  );
}
