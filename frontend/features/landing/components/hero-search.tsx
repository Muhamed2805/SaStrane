'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import { LISTING_LOCATIONS } from '@/features/listings/constants';

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (location) params.set('location', location);
    const search = params.toString();
    router.push(`/listings${search ? `?${search}` : ''}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 grid gap-2 rounded-xl border bg-white p-2 shadow-lg shadow-slate-900/5 sm:grid-cols-[1fr_0.7fr_auto]"
    >
      <label className="flex min-w-0 items-center gap-3 px-3">
        <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="sr-only">Posao ili usluga</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Šta tražiš?"
        />
      </label>

      <label className="flex min-w-0 items-center gap-3 border-t px-3 sm:border-t-0 sm:border-l">
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="sr-only">Lokacija</span>
        <select
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
        >
          <option value="">Sve lokacije</option>
          {LISTING_LOCATIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="h-12 rounded-lg bg-brand-orange px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-dark"
      >
        Pretraži
      </button>
    </form>
  );
}
