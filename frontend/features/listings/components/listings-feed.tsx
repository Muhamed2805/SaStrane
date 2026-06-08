'use client';

import { useEffect, useState } from 'react';
import { listingsApi, type ListingFromApi } from '../api';
import { ListingCard } from './listing-card';

const CATEGORIES = ['Sve', 'Košenje trave', 'Pranje auta', 'Selidbe', 'IT pomoć'];
const LOCATIONS = ['Sve', 'Sarajevo', 'Ilidža', 'Stup', 'Vogošća'];

export function ListingsFeed() {
  const [listings, setListings] = useState<ListingFromApi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('Sve');
  const [location, setLocation] = useState('Sve');

  useEffect(() => {
    listingsApi
      .getAll()
      .then(setListings)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = listings.filter((x) => {
    const matchesQ =
      q.trim().length === 0 || x.title.toLowerCase().includes(q.trim().toLowerCase());
    const matchesCategory = category === 'Sve' || x.category === category;
    const matchesLocation = location === 'Sve' || x.location === location;
    return matchesQ && matchesCategory && matchesLocation;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          placeholder="Pretraži (npr. košenje, selidba...)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Učitavanje oglasa...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Greška: {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Nema oglasa za ove filtere.
            </div>
          ) : (
            filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))
          )}
        </div>
      )}
    </div>
  );
}