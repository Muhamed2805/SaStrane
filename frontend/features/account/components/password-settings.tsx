'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { accountApi } from '../api';
import { PasswordInput } from './password-input';

const PASSWORD_MIN_LENGTH = 8;

// A new password while signed in. The server signs out the other devices.
export function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [checked, setChecked] = useState(false);

  const change = useMutation({
    mutationFn: () =>
      accountApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setRepeated('');
      setChecked(false);
      toast.success('Lozinka je promijenjena. Ostali uređaji su odjavljeni.');
    },
  });

  const wrongPassword =
    change.error instanceof ApiError && change.error.code === 'WRONG_PASSWORD';
  const tooShort = newPassword.length < PASSWORD_MIN_LENGTH;
  const mismatch = newPassword !== repeated;

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    change.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (!currentPassword || tooShort || mismatch) return;
    change.mutate();
  };

  return (
    <section
      aria-labelledby="password-settings-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="password-settings-heading" className="text-lg font-bold">
        Lozinka
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nakon promjene ovaj uređaj ostaje prijavljen, a svi ostali se
        odjavljuju.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
        <PasswordInput
          id="settings-current-password"
          label="Trenutna lozinka"
          value={currentPassword}
          onChange={edit(setCurrentPassword)}
          autoComplete="current-password"
          error={
            wrongPassword
              ? 'Trenutna lozinka nije tačna.'
              : checked && !currentPassword
                ? 'Unesi trenutnu lozinku.'
                : null
          }
        />
        <PasswordInput
          id="settings-new-password"
          label="Nova lozinka"
          hint={`Najmanje ${PASSWORD_MIN_LENGTH} znakova`}
          value={newPassword}
          onChange={edit(setNewPassword)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          error={
            checked && tooShort
              ? `Nova lozinka mora imati najmanje ${PASSWORD_MIN_LENGTH} znakova.`
              : null
          }
        />
        <PasswordInput
          id="settings-repeat-password"
          label="Ponovi novu lozinku"
          value={repeated}
          onChange={edit(setRepeated)}
          autoComplete="new-password"
          error={checked && mismatch ? 'Lozinke se ne podudaraju.' : null}
        />

        {change.error && !wrongPassword ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {change.error.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={change.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {change.isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Promijeni lozinku
          </button>
        </div>
      </form>
    </section>
  );
}
