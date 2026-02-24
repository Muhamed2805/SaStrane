"use client";

import { useMemo, useState } from "react";
import { MOCK_LISTINGS } from "../mock";
import { ListingCard } from "./listing-card";

const CATEGORIES = ["Sve", "Košenje trave", "Pranje auta", "Selidbe", "IT pomoć"];
const LOCATIONS = ["Sve", "Sarajevo", "Ilidža", "Stup", "Vogošća"];

export function ListingsFeed() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Sve");
  const [location, setLocation] = useState("Sve");

  const filtered = useMemo(() => {
    return MOCK_LISTINGS.filter((x) => {
      const matchesQ =
        q.trim().length === 0 ||
        x.title.toLowerCase().includes(q.trim().toLowerCase());

      const matchesCategory = category === "Sve" || x.category === category;
      const matchesLocation = location === "Sve" || x.location === location;

      return matchesQ && matchesCategory && matchesLocation;
    });
  }, [q, category, location]);

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
    </div>
  );
}