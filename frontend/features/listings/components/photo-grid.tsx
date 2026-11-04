'use client';

import { useId, useRef } from 'react';
import Image from 'next/image';
import { ImagePlus, LoaderCircle, Star, Trash2 } from 'lucide-react';
import { MAX_PHOTOS, PHOTO_ACCEPT } from '../photos';

export type PhotoGridItem = {
  key: string;
  src: string;
  alt: string;
};

type PhotoGridProps = {
  items: PhotoGridItem[];
  // Photos being uploaded, shown as spinners after the others.
  pendingCount?: number;
  disabled?: boolean;
  errors?: string[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMakeCover: (index: number) => void;
};

// The photos of a job as tiles. The first is the cover; the last tile adds
// more until there are five.
export function PhotoGrid({
  items,
  pendingCount = 0,
  disabled = false,
  errors = [],
  onAdd,
  onRemove,
  onMakeCover,
}: PhotoGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const canAdd = items.length + pendingCount < MAX_PHOTOS;

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              unoptimized
              sizes="(min-width: 640px) 200px, 50vw"
              className="object-cover"
            />
            {index === 0 ? (
              <span className="absolute top-2 left-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-primary shadow-sm">
                Naslovna
              </span>
            ) : null}
            <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
              {index > 0 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onMakeCover(index)}
                  className="inline-flex size-8 items-center justify-center rounded-lg bg-white/95 text-foreground shadow-sm hover:text-primary disabled:opacity-50"
                  aria-label={`Postavi sliku ${index + 1} kao naslovnu`}
                  title="Postavi kao naslovnu"
                >
                  <Star className="size-4" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(index)}
                className="inline-flex size-8 items-center justify-center rounded-lg bg-white/95 text-foreground shadow-sm hover:text-red-600 disabled:opacity-50"
                aria-label={`Ukloni sliku ${index + 1}`}
                title="Ukloni"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}

        {Array.from({ length: pendingCount }, (_, index) => (
          <li
            key={`pending-${index}`}
            className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-muted"
          >
            <LoaderCircle
              className="size-6 animate-spin text-primary"
              aria-label="Slika se dodaje"
            />
          </li>
        ))}

        {canAdd ? (
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              aria-describedby={hintId}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="size-6" aria-hidden="true" />
              Dodaj slike
            </button>
          </li>
        ) : null}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        hidden
        data-testid="photo-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Lets the same file be picked again after it was removed.
          event.target.value = '';
          if (files.length > 0) onAdd(files);
        }}
      />

      <p id={hintId} className="mt-2 text-xs leading-5 text-muted-foreground">
        Do {MAX_PHOTOS} slika, JPG, PNG, WebP ili AVIF, najviše 5 MB po slici.
        Prva slika je naslovna.
      </p>

      {errors.length > 0 ? (
        <ul
          className="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
