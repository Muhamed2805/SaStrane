'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PHOTO_ACCEPT, pickPhotos } from '@/features/listings/photos';
import type { UserProfile } from '@/features/ratings/api';
import { profileKeys, userProfileQuery } from '@/features/ratings/queries';
import {
  MAX_CAPTION_LENGTH,
  MAX_PORTFOLIO_PHOTOS,
  portfolioApi,
  type PortfolioPhoto,
} from '../api';

// The user's gallery of work in the account settings. Every change is saved
// at once and shows on the public profile.
export function PortfolioSettings({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const profile = useQuery(userProfileQuery(userId));
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const photos = profile.data?.portfolio ?? [];

  const saved = (change: (photos: PortfolioPhoto[]) => PortfolioPhoto[]) =>
    queryClient.setQueryData<UserProfile>(
      profileKeys.detail(userId),
      (current) =>
        current && { ...current, portfolio: change(current.portfolio) },
    );

  // One at a time, so each finished photo shows up and the limit holds.
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const failures: string[] = [];
      setPendingCount(files.length);
      for (const file of files) {
        try {
          const photo = await portfolioApi.add(file);
          saved((current) => [...current, photo]);
        } catch (error) {
          failures.push(
            `${file.name}: ${error instanceof Error ? error.message : 'slika nije dodana.'}`,
          );
        }
        setPendingCount((count) => count - 1);
      }
      return failures;
    },
    // Added to the reasons files were left out when they were picked.
    onSuccess: (failures) => setErrors((picked) => [...picked, ...failures]),
    onSettled: () => setPendingCount(0),
  });

  const remove = useMutation({
    mutationFn: (photo: PortfolioPhoto) => portfolioApi.remove(photo.id),
    onSuccess: (_, photo) => {
      saved((current) => current.filter((item) => item.id !== photo.id));
      toast.success('Slika je uklonjena iz galerije.');
    },
    onError: (error) => toast.error(error.message),
  });

  const caption = useMutation({
    mutationFn: (input: { photo: PortfolioPhoto; caption: string }) =>
      portfolioApi.updateCaption(input.photo.id, input.caption),
    onSuccess: (updated) => {
      saved((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success('Opis slike je sačuvan.');
    },
    onError: (error) => toast.error(error.message),
  });

  const busy = upload.isPending || remove.isPending;
  const canAdd = photos.length + pendingCount < MAX_PORTFOLIO_PHOTOS;

  return (
    <section
      aria-labelledby="portfolio-settings-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="portfolio-settings-heading" className="text-lg font-bold">
        Galerija radova
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Slike poslova iz tvog dosadašnjeg rada. Vide se na tvom{' '}
        <Link
          href={`/users/${userId}`}
          className="font-semibold text-primary hover:underline"
        >
          javnom profilu
        </Link>
        .
      </p>

      {profile.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Učitavam galeriju...
        </p>
      ) : profile.error ? (
        <p className="mt-5 text-sm text-red-600" role="alert">
          {profile.error.message}
        </p>
      ) : (
        <>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl border bg-background"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={photo.thumbnailUrl}
                    alt={photo.caption ?? `Slika rada ${index + 1}`}
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 200px, 50vw"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm('Ukloniti ovu sliku iz galerije?')) {
                        return;
                      }
                      setErrors([]);
                      remove.mutate(photo);
                    }}
                    className="absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-lg bg-white/95 text-foreground shadow-sm hover:text-red-600 disabled:opacity-50"
                    aria-label={`Ukloni sliku rada ${index + 1}`}
                    title="Ukloni"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <input
                  // A saved caption resets the field to the stored text.
                  key={photo.caption ?? ''}
                  aria-label={`Opis slike rada ${index + 1}`}
                  placeholder="Dodaj opis"
                  maxLength={MAX_CAPTION_LENGTH}
                  defaultValue={photo.caption ?? ''}
                  onBlur={(event) => {
                    const text = event.currentTarget.value.trim();
                    if (text !== (photo.caption ?? '')) {
                      caption.mutate({ photo, caption: text });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className="h-9 w-full border-t bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground focus:bg-primary/5"
                />
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
                  disabled={busy}
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
            data-testid="portfolio-input"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Lets the same file be picked again after it was removed.
              event.target.value = '';
              if (files.length === 0) return;
              const picked = pickPhotos(
                files,
                photos.length,
                MAX_PORTFOLIO_PHOTOS,
                `Galerija može imati najviše ${MAX_PORTFOLIO_PHOTOS} slika.`,
              );
              setErrors(picked.errors);
              if (picked.accepted.length > 0) upload.mutate(picked.accepted);
            }}
          />

          <p
            id={hintId}
            className="mt-2 text-xs leading-5 text-muted-foreground"
          >
            Do {MAX_PORTFOLIO_PHOTOS} slika, JPG, PNG, WebP ili AVIF, najviše 5
            MB po slici. Opis se sačuva kad izađeš iz polja.
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
        </>
      )}
    </section>
  );
}
