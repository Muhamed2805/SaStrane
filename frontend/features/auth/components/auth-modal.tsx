'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { useAuthStore } from '../store';
import type { RegisterPayload } from '../api';

type Tab = 'login' | 'register';
type UserRole = RegisterPayload['role'];

const roles: Array<{
  value: UserRole;
  label: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    value: 'CLIENT',
    label: 'Tražim izvođače',
    description: 'Želim objavljivati poslove.',
    icon: Building2,
  },
  {
    value: 'EXECUTOR',
    label: 'Tražim poslove',
    description: 'Želim se prijavljivati na oglase.',
    icon: BriefcaseBusiness,
  },
  {
    value: 'BOTH',
    label: 'Oboje',
    description: 'Želim objavljivati i raditi.',
    icon: UsersRound,
  },
];

const fieldClassName =
  'h-12 w-full rounded-lg border bg-background pr-4 pl-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10';

export function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    clearError,
    login,
    register,
    isLoading,
    error,
  } = useAuthStore();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('BOTH');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isAuthModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) closeAuthModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAuthModal, isAuthModalOpen, isLoading]);

  if (!isAuthModalOpen) return null;

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('BOTH');
    setShowPassword(false);
    clearError();
  };

  const handleClose = () => {
    if (isLoading) return;
    resetFields();
    closeAuthModal();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tab === 'login') {
      await login({ email: email.trim(), password });
    } else {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
      });
    }

    if (!useAuthStore.getState().isAuthModalOpen) resetFields();
  };

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    resetFields();
  };

  const isInvalid =
    !email.trim() ||
    !password ||
    (tab === 'register' && (fullName.trim().length < 2 || password.length < 8));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-brand-navy/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Zatvori prozor za prijavu"
      />

      <div
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Zatvori"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <div className="px-6 pt-7 sm:px-8">
          <BrandLogo />
          <h2 id="auth-dialog-title" className="mt-6 text-2xl font-bold">
            {tab === 'login' ? 'Dobro došao nazad' : 'Kreiraj svoj račun'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tab === 'login'
              ? 'Prijavi se kako bi upravljao oglasima i prijavama.'
              : 'Pridruži se lokalnoj zajednici klijenata i izvođača.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                tab === 'login'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => switchTab('login')}
              aria-pressed={tab === 'login'}
            >
              Prijava
            </button>
            <button
              type="button"
              className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                tab === 'register'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => switchTab('register')}
              aria-pressed={tab === 'register'}
            >
              Registracija
            </button>
          </div>
        </div>

        <form className="space-y-5 p-6 sm:p-8" onSubmit={handleSubmit}>
          {tab === 'register' ? (
            <div>
              <label htmlFor="auth-full-name" className="text-sm font-semibold">
                Ime i prezime
              </label>
              <div className="relative mt-2">
                <UserRound
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                  aria-hidden="true"
                />
                <input
                  id="auth-full-name"
                  className={fieldClassName}
                  placeholder="Tvoje ime i prezime"
                  autoComplete="name"
                  value={fullName}
                  minLength={2}
                  required
                  onChange={(event) => {
                    setFullName(event.target.value);
                    clearError();
                  }}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="auth-email" className="text-sm font-semibold">
              Email adresa
            </label>
            <div className="relative mt-2">
              <Mail
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
              <input
                id="auth-email"
                className={fieldClassName}
                placeholder="ime@primjer.ba"
                type="email"
                autoComplete="email"
                value={email}
                required
                autoFocus
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearError();
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="auth-password" className="text-sm font-semibold">
                Lozinka
              </label>
              {tab === 'register' ? (
                <span className="text-xs text-muted-foreground">
                  Najmanje 8 znakova
                </span>
              ) : null}
            </div>
            <div className="relative mt-2">
              <LockKeyhole
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
              <input
                id="auth-password"
                className={`${fieldClassName} pr-12`}
                placeholder="Unesi lozinku"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  tab === 'login' ? 'current-password' : 'new-password'
                }
                value={password}
                minLength={tab === 'register' ? 8 : 1}
                required
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {tab === 'register' ? (
            <fieldset>
              <legend className="text-sm font-semibold">
                Kako želiš koristiti SaStrane?
              </legend>
              <div className="mt-3 grid gap-2">
                {roles.map(({ value, label, description, icon: Icon }) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      role === value
                        ? 'border-primary bg-primary/[0.06]'
                        : 'hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
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
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || isInvalid}
          >
            {isLoading ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {isLoading
              ? 'Molimo sačekaj...'
              : tab === 'login'
                ? 'Prijavi se'
                : 'Kreiraj račun'}
          </button>

          <p className="text-center text-xs leading-5 text-muted-foreground">
            Nastavkom prihvataš pravila korištenja i potvrđuješ da ćeš platformu
            koristiti odgovorno.
          </p>
        </form>
      </div>
    </div>
  );
}
