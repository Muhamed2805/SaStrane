'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store';
import { listingsApi } from '@/features/listings/api';

const CATEGORIES = ['Košenje trave', 'Pranje auta', 'Selidbe', 'IT pomoć', 'Čišćenje', 'Montaža', 'Dostava', 'Ostalo'];
const LOCATIONS = ['Sarajevo', 'Ilidža', 'Stup', 'Vogošća', 'Mostar', 'Banja Luka', 'Tuzla', 'Zenica'];

export default function CreateListingPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !token) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Moraš biti prijavljen da bi objavio oglas.
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!title || !category || !location) return;

    setIsLoading(true);
    setError(null);

    try {
      const listing = await listingsApi.create(
        { title, category, location, budget: budget || undefined, description: description || undefined },
        token,
      );
      router.push(`/listings/${listing.id}`);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novi oglas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Objavi posao koji trebaš obaviti.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Naslov</label>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="npr. Košenje trave u dvorištu"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Kategorija</label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Lokacija</label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Budžet (opcionalno)</label>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="npr. 50 KM ili 20 KM/h"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Opis (opcionalno)</label>
          <textarea
            className="min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
            placeholder="Opiši posao detaljnije..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          className="h-10 w-full rounded-md bg-black text-sm text-white hover:opacity-90 disabled:opacity-50"
          disabled={isLoading || !title}
          onClick={handleSubmit}
        >
          {isLoading ? 'Objavljujem...' : 'Objavi oglas'}
        </button>
      </div>
    </div>
  );
}