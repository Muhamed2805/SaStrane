'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ListingPhoto } from '../api';

type ListingGalleryProps = {
  photos: ListingPhoto[];
  title: string;
};

// The photos on the job page: one large, the others as thumbnails to pick.
// The large photo opens in full size in a new tab.
export function ListingGallery({ photos, title }: ListingGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = photos.at(selectedIndex) ?? photos.at(0);
  if (!selected) return null;

  return (
    <section
      aria-label="Slike posla"
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
    >
      <a
        href={selected.url}
        target="_blank"
        rel="noreferrer"
        className="relative block aspect-[4/3] bg-muted"
        title="Otvori sliku u punoj veličini"
      >
        <Image
          key={selected.id}
          src={selected.url}
          alt={`${title}, slika ${photos.indexOf(selected) + 1} od ${photos.length}`}
          fill
          unoptimized
          preload={selected === photos[0]}
          sizes="(min-width: 1024px) 760px, 100vw"
          className="object-contain"
        />
      </a>

      {photos.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto border-t p-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`Prikaži sliku ${index + 1}`}
                aria-current={photo === selected ? 'true' : undefined}
                className={`relative block h-16 w-20 overflow-hidden rounded-lg border-2 transition-colors ${
                  photo === selected
                    ? 'border-primary'
                    : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                <Image
                  src={photo.thumbnailUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
