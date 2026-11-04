'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { endDeletedSession } from '@/features/auth/session';
import { ApiError } from '@/lib/api-client';
import { removeUserQueries } from '@/lib/query-client';
import { accountApi } from '../api';
import { PasswordInput } from './password-input';

// Deleting the account asks for the password first, so a device left
// signed in cannot do it.
export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  const remove = useMutation({
    mutationFn: () => accountApi.deleteAccount(password),
    onSuccess: () => {
      endDeletedSession();
      removeUserQueries();
      toast.success('Nalog je obrisan.');
      router.replace('/');
    },
  });

  const wrongPassword =
    remove.error instanceof ApiError && remove.error.code === 'WRONG_PASSWORD';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    remove.mutate();
  };

  const cancel = () => {
    setConfirming(false);
    setPassword('');
    remove.reset();
  };

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="rounded-2xl border border-red-200 bg-card p-6 shadow-sm"
    >
      <h2
        id="delete-account-heading"
        className="flex items-center gap-2 text-lg font-bold text-red-700"
      >
        <TriangleAlert className="size-5" aria-hidden="true" />
        Brisanje naloga
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Brisanje je trajno i ne može se poništiti. Uz nalog se brišu:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>tvoji oglasi i njihove slike,</li>
        <li>poslane i primljene prijave,</li>
        <li>razgovori i poruke,</li>
        <li>date i dobijene ocjene.</li>
      </ul>

      {confirming ? (
        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <PasswordInput
            id="delete-account-password"
            label="Za potvrdu unesi lozinku"
            value={password}
            onChange={(value) => {
              setPassword(value);
              remove.reset();
            }}
            autoComplete="current-password"
            error={wrongPassword ? 'Lozinka nije tačna.' : null}
          />

          {remove.error && !wrongPassword ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {remove.error.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancel}
              disabled={remove.isPending}
              className="rounded-xl border px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={!password || remove.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {remove.isPending ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Trajno obriši nalog
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Obriši nalog
          </button>
        </div>
      )}
    </section>
  );
}
