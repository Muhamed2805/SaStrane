'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, LoaderCircle, Mail, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthUser } from '@/features/auth/api';
import { ROLE_OPTIONS, type UserRole } from '@/features/auth/roles';
import { updateSessionUser } from '@/features/auth/session';
import type { ListingCategory } from '@/features/listings/api';
import {
  CATEGORY_LABELS,
  LISTING_CATEGORIES,
} from '@/features/listings/constants';
import { accountApi } from '../api';
import { fieldClassName } from './password-input';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const BIO_MAX_LENGTH = 500;

// The name, the role, the introduction and the kinds of jobs the user does.
// The email address cannot be changed.
export function ProfileSettings({ user }: { user: AuthUser }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState<UserRole>(user.role);
  const [bio, setBio] = useState(user.bio ?? '');
  const [skills, setSkills] = useState<ListingCategory[]>(user.skills);

  const save = useMutation({
    mutationFn: () =>
      accountApi.updateProfile({
        fullName: fullName.trim(),
        role,
        bio: bio.trim(),
        skills,
      }),
    onSuccess: (updated) => {
      updateSessionUser(updated);
      setFullName(updated.fullName);
      toast.success('Profil je sačuvan.');
    },
  });

  const trimmedName = fullName.trim();
  const changed =
    trimmedName !== user.fullName ||
    role !== user.role ||
    bio.trim() !== (user.bio ?? '') ||
    skills.join() !== user.skills.join();
  const nameTooShort = trimmedName.length < NAME_MIN_LENGTH;

  // Kept in the order of the list, so picking the same skills again counts
  // as no change.
  const toggleSkill = (skill: ListingCategory) => {
    setSkills((current) =>
      LISTING_CATEGORIES.filter((category) =>
        category === skill
          ? !current.includes(skill)
          : current.includes(category),
      ),
    );
    save.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!changed || nameTooShort) return;
    save.mutate();
  };

  return (
    <section
      aria-labelledby="profile-settings-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="profile-settings-heading" className="text-lg font-bold">
        Podaci o profilu
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ime vide klijenti i izvođači na oglasima, prijavama i porukama. Opis i
        poslove koje radiš vide svi na tvom javnom profilu.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
        <div>
          <label htmlFor="settings-email" className="text-sm font-semibold">
            Email adresa
          </label>
          <div className="relative mt-2">
            <Mail
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="settings-email"
              className={`${fieldClassName} bg-muted/60 text-muted-foreground`}
              value={user.email}
              readOnly
              aria-describedby="settings-email-hint"
            />
          </div>
          <p
            id="settings-email-hint"
            className="mt-2 text-xs text-muted-foreground"
          >
            Email adresa se ne može promijeniti.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="settings-name" className="text-sm font-semibold">
              Ime i prezime
            </label>
            <span className="text-xs text-muted-foreground">
              {trimmedName.length}/{NAME_MAX_LENGTH}
            </span>
          </div>
          <div className="relative mt-2">
            <UserRound
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <input
              id="settings-name"
              className={fieldClassName}
              value={fullName}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              required
              aria-invalid={nameTooShort ? true : undefined}
              aria-describedby={
                nameTooShort ? 'settings-name-error' : undefined
              }
              onChange={(event) => {
                setFullName(event.target.value);
                save.reset();
              }}
            />
          </div>
          {nameTooShort ? (
            <p id="settings-name-error" className="mt-2 text-xs text-red-600">
              Ime mora imati najmanje {NAME_MIN_LENGTH} znaka.
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">
            Kako koristiš SaStrane?
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/20 ${
                  role === value
                    ? 'border-primary bg-primary/[0.06]'
                    : 'hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="settings-role"
                  value={value}
                  checked={role === value}
                  onChange={() => {
                    setRole(value);
                    save.reset();
                  }}
                  className="sr-only"
                />
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    role === value
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="settings-bio" className="text-sm font-semibold">
              O meni
            </label>
            <span className="text-xs text-muted-foreground">
              {bio.trim().length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="settings-bio"
            className="mt-2 min-h-28 w-full resize-y rounded-lg border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10"
            value={bio}
            maxLength={BIO_MAX_LENGTH}
            placeholder="Npr. Imam pet godina iskustva u selidbama i vlastiti kombi. Radim vikendom."
            aria-describedby="settings-bio-hint"
            onChange={(event) => {
              setBio(event.target.value);
              save.reset();
            }}
          />
          <p
            id="settings-bio-hint"
            className="mt-2 text-xs text-muted-foreground"
          >
            Neobavezno. Napiši ukratko šta radiš i koliko iskustva imaš.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">Poslovi koje radiš</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Neobavezno. Klijentima pokazuje u čemu možeš pomoći.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LISTING_CATEGORIES.map((category) => {
              const selected = skills.includes(category);
              return (
                <label
                  key={category}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/20 ${
                    selected
                      ? 'border-primary bg-primary/[0.08] text-primary'
                      : 'hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSkill(category)}
                    className="sr-only"
                  />
                  {selected ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : null}
                  {CATEGORY_LABELS[category]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {save.error ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {save.error.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!changed || nameTooShort || save.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Sačuvaj promjene
          </button>
        </div>
      </form>
    </section>
  );
}
