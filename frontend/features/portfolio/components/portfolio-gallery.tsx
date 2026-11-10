'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { userProfileQuery } from '@/features/ratings/queries';

// The photos of work on a public profile. A photo opens large, with its
// caption and arrows to the others. Shows nothing for an empty gallery.
export function PortfolioGallery({ userId }: { userId: string }) {
  const { data } = useQuery(userProfileQuery(userId));
  const photos = data?.portfolio ?? [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? undefined : photos.at(openIndex);
  const count = photos.length;

  useEffect(() => {
    if (openIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null);
      if (event.key === 'ArrowRight') {
        setOpenIndex((index) => (index === null ? index : (index + 1) % count));
      }
      if (event.key === 'ArrowLeft') {
        setOpenIndex((index) =>
          index === null ? index : (index - 1 + count) % count,
        );
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openIndex, count]);

  if (count === 0) return null;

  const step = (by: number) =>
    setOpenIndex((index) =>
      index === null ? index : (index + by + count) % count,
    );

  return (
    <section aria-labelledby="portfolio-title" className="space-y-3">
      <h2 id="portfolio-title" className="text-lg font-bold">
        Galerija radova
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Prikaži sliku rada ${index + 1}${photo.caption ? `: ${photo.caption}` : ''}`}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl border bg-muted shadow-sm"
            >
              <Image
                src={photo.thumbnailUrl}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 640px) 180px, 50vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
              {photo.caption ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-left text-xs font-medium text-white">
                  {photo.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {open && openIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-brand-navy/85 backdrop-blur-sm"
            onClick={() => setOpenIndex(null)}
            aria-label="Zatvori sliku"
          />
          <figure
            className="relative z-10 flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Slika rada ${openIndex + 1} od ${count}`}
          >
            <div className="relative min-h-0 flex-1 bg-black">
              <Image
                key={open.id}
                src={open.url}
                alt={open.caption ?? `Slika rada ${openIndex + 1} od ${count}`}
                width={open.width}
                height={open.height}
                unoptimized
                className="mx-auto max-h-[75vh] w-auto object-contain"
              />
              {count > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                    aria-label="Prethodna slika"
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                    aria-label="Sljedeća slika"
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                autoFocus
                onClick={() => setOpenIndex(null)}
                className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                aria-label="Zatvori"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <figcaption className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="min-w-0 break-words">{open.caption}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {openIndex + 1} / {count}
              </span>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
