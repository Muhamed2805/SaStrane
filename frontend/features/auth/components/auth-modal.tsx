'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { useAuthStore } from '../store';
import type { RegisterPayload } from '../api';

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
    authModalTab,
    verificationEmail,
    closeAuthModal,
    clearError,
    setAuthModalTab,
    login,
    register,
    verifyEmail,
    resendVerification,
    isLoading,
    error,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('BOTH');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendConfirmation, setResendConfirmation] = useState(false);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  if (!isAuthModalOpen) return null;

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('BOTH');
    setShowPassword(false);
    setVerificationCode('');
    setResendCooldown(0);
    setResendConfirmation(false);
    clearError();
  };

  const handleClose = () => {
    if (isLoading) return;
    resetFields();
    closeAuthModal();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authModalTab === 'login') {
      await login({ email: email.trim(), password });
    } else {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
      });
    }

    const nextState = useAuthStore.getState();
    if (nextState.authModalTab === 'verify') {
      setPassword('');
      setVerificationCode('');
      setResendCooldown(60);
    }
    if (!nextState.isAuthModalOpen) resetFields();
  };

  const handleVerificationSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const verified = await verifyEmail(verificationCode);
    if (verified) resetFields();
  };

  const handleResend = async () => {
    setResendConfirmation(false);
    const sent = await resendVerification();
    if (sent) {
      setVerificationCode('');
      setResendCooldown(60);
      setResendConfirmation(true);
    }
  };

  const switchTab = (nextTab: 'login' | 'register') => {
    setAuthModalTab(nextTab);
    resetFields();
  };

  const isInvalid =
    !email.trim() ||
    !password ||
    (authModalTab === 'register' &&
      (fullName.trim().length < 2 || password.length < 8));

  const title =
    authModalTab === 'login'
      ? 'Dobro došao nazad'
      : authModalTab === 'register'
        ? 'Kreiraj svoj račun'
        : 'Potvrdi svoj email';
  const description =
    authModalTab === 'login'
      ? 'Prijavi se kako bi upravljao oglasima i prijavama.'
      : authModalTab === 'register'
        ? 'Pridruži se lokalnoj zajednici klijenata i izvođača.'
        : `Poslali smo šestocifreni kod na ${verificationEmail ?? 'tvoj email'}.`;

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
          {authModalTab === 'verify' ? (
            <span className="mt-7 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
          ) : null}
          <h2 id="auth-dialog-title" className="mt-6 text-2xl font-bold">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          {authModalTab !== 'verify' ? (
            <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  authModalTab === 'login'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => switchTab('login')}
                aria-pressed={authModalTab === 'login'}
              >
                Prijava
              </button>
              <button
                type="button"
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  authModalTab === 'register'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => switchTab('register')}
                aria-pressed={authModalTab === 'register'}
              >
                Registracija
              </button>
            </div>
          ) : null}
        </div>

        {authModalTab === 'verify' ? (
          <form
            className="space-y-5 p-6 sm:p-8"
            onSubmit={handleVerificationSubmit}
          >
            <div>
              <label
                htmlFor="auth-verification-code"
                className="text-sm font-semibold"
              >
                Verifikacijski kod
              </label>
              <input
                id="auth-verification-code"
                className="mt-2 h-14 w-full rounded-xl border bg-background px-4 text-center font-mono text-2xl font-bold tracking-[0.45em] outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/10"
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verificationCode}
                autoFocus
                required
                onChange={(event) => {
                  setVerificationCode(
                    event.target.value.replace(/\D/g, '').slice(0, 6),
                  );
                  setResendConfirmation(false);
                  clearError();
                }}
              />
            </div>

            {resendConfirmation ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                Novi kod je poslan.
              </div>
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
              disabled={isLoading || verificationCode.length !== 6}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {isLoading ? 'Provjera koda...' : 'Potvrdi i nastavi'}
            </button>

            <div className="flex flex-col items-center gap-3 border-t pt-5 text-sm">
              <p className="text-muted-foreground">Nisi dobio email?</p>
              <button
                type="button"
                disabled={isLoading || resendCooldown > 0}
                onClick={() => void handleResend()}
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {resendCooldown > 0
                  ? `Pošalji ponovo za ${resendCooldown}s`
                  : 'Pošalji novi kod'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => switchTab('login')}
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Nazad na prijavu
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-5 p-6 sm:p-8" onSubmit={handleSubmit}>
            {authModalTab === 'register' ? (
              <div>
                <label
                  htmlFor="auth-full-name"
                  className="text-sm font-semibold"
                >
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
                <label
                  htmlFor="auth-password"
                  className="text-sm font-semibold"
                >
                  Lozinka
                </label>
                {authModalTab === 'register' ? (
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
                    authModalTab === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  value={password}
                  minLength={authModalTab === 'register' ? 8 : 1}
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
                  aria-label={
                    showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {authModalTab === 'register' ? (
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
                : authModalTab === 'login'
                  ? 'Prijavi se'
                  : 'Kreiraj račun'}
            </button>

            <p className="text-center text-xs leading-5 text-muted-foreground">
              Nastavkom prihvataš pravila korištenja i potvrđuješ da ćeš
              platformu koristiti odgovorno.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
