'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import type { AuthUser } from '@/features/auth/api';
import { updateSessionUser } from '@/features/auth/session';
import { PHOTO_ACCEPT, photoFileError } from '@/features/listings/photos';
import { accountApi } from '../api';

// The profile photo. The backend cuts a square around the face.
export function AvatarSettings({ user }: { user: AuthUser }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: accountApi.setAvatar,
    onSuccess: (updated) => {
      updateSessionUser(updated);
      toast.success('Slika profila je sačuvana.');
    },
  });
  const remove = useMutation({
    mutationFn: accountApi.removeAvatar,
    onSuccess: (updated) => {
      updateSessionUser(updated);
      toast.success('Slika profila je uklonjena.');
    },
  });

  const pending = upload.isPending || remove.isPending;
  const error = fileError ?? upload.error?.message ?? remove.error?.message;

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Picking the same file again must fire another change.
    event.target.value = '';
    if (!file) return;

    upload.reset();
    remove.reset();
    const problem = photoFileError(file);
    setFileError(problem);
    if (!problem) upload.mutate(file);
  };

  return (
    <section
      aria-labelledby="avatar-settings-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="avatar-settings-heading" className="text-lg font-bold">
        Slika profila
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vidi se u meniju i na tvom javnom profilu.
      </p>

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar
          name={user.fullName}
          url={user.avatarUrl}
          className="size-24 rounded-2xl bg-primary text-3xl font-bold text-primary-foreground"
        />
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {upload.isPending ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Camera className="size-4" aria-hidden="true" />
              )}
              {user.avatarUrl ? 'Promijeni sliku' : 'Dodaj sliku'}
            </button>
            {user.avatarUrl ? (
              <button
                type="button"
                onClick={() => {
                  setFileError(null);
                  upload.reset();
                  remove.mutate();
                }}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {remove.isPending ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                Ukloni
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP ili AVIF, najviše 5 MB. Slika se izreže u kvadrat.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={pick}
            className="sr-only"
            tabIndex={-1}
            aria-label="Odaberi sliku profila"
          />
        </div>
      </div>

      {error ? (
        <div
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
