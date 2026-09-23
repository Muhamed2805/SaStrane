'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../store';

const RESEND_COOLDOWN_MS = 60_000;
const fieldClassName =
  'h-12 w-full rounded-lg border bg-background pr-4 pl-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10';

export function PasswordResetFlow({ initialEmail }: { initialEmail: string }) {
  const {
    authModalTab,
    passwordResetEmail,
    requestPasswordReset,
    resetPassword,
    setAuthModalTab,
    clearError,
    isLoading,
    error,
  } = useAuthStore();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [resendConfirmation, setResendConfirmation] = useState(false);

  useEffect(() => {
    if (!resendAvailableAt) return;

    const updateCooldown = () => {
      const seconds = Math.max(
        0,
        Math.ceil((resendAvailableAt - Date.now()) / 1000),
      );
      setResendCooldown(seconds);
      if (seconds === 0) setResendAvailableAt(null);
    };

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  const startResendCooldown = () => {
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
    setResendCooldown(RESEND_COOLDOWN_MS / 1000);
  };

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sent = await requestPasswordReset(email);
    if (sent) startResendCooldown();
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) return;
    await resetPassword(code, password);
  };

  const handleResend = async () => {
    if (!passwordResetEmail) return;
    setResendConfirmation(false);
    const sent = await requestPasswordReset(passwordResetEmail);
    if (sent) {
      setCode('');
      setResendConfirmation(true);
      startResendCooldown();
    }
  };

  const backToLogin = () => {
    clearError();
    setAuthModalTab('login');
  };

  if (authModalTab === 'reset-success') {
    return (
      <div className="space-y-6 p-6 sm:p-8">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-6">
            Nova lozinka je sačuvana. Sada se možeš prijaviti s novom lozinkom.
          </p>
        </div>
        <button
          type="button"
          onClick={backToLogin}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          Vrati se na prijavu
        </button>
      </div>
    );
  }

  if (authModalTab === 'forgot') {
    return (
      <form className="space-y-5 p-6 sm:p-8" onSubmit={handleRequest}>
        <div>
          <label
            htmlFor="password-reset-email"
            className="text-sm font-semibold"
          >
            Email adresa
          </label>
          <div className="relative mt-2">
            <Mail
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <input
              id="password-reset-email"
              className={fieldClassName}
              placeholder="ime@primjer.ba"
              type="email"
              autoComplete="email"
              value={email}
              autoFocus
              required
              onChange={(event) => {
                setEmail(event.target.value);
                clearError();
              }}
            />
          </div>
        </div>

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
          disabled={isLoading || !email.trim()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isLoading ? 'Slanje koda...' : 'Pošalji kod'}
        </button>

        <button
          type="button"
          onClick={backToLogin}
          className="mx-auto flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Nazad na prijavu
        </button>
      </form>
    );
  }

  const passwordsMatch = password === confirmPassword;
  const isResetInvalid =
    code.length !== 6 || password.length < 8 || !passwordsMatch;

  return (
    <form className="space-y-5 p-6 sm:p-8" onSubmit={handleReset}>
      <div>
        <label htmlFor="password-reset-code" className="text-sm font-semibold">
          Kod iz emaila
        </label>
        <input
          id="password-reset-code"
          className="mt-2 h-14 w-full rounded-xl border bg-background px-4 text-center font-mono text-2xl font-bold tracking-[0.45em] outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/10"
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          autoFocus
          required
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
            setResendConfirmation(false);
            clearError();
          }}
        />
      </div>

      <div>
        <label
          htmlFor="password-reset-new-password"
          className="text-sm font-semibold"
        >
          Nova lozinka
        </label>
        <div className="relative mt-2">
          <LockKeyhole
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
          <input
            id="password-reset-new-password"
            className={`${fieldClassName} pr-12`}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={8}
            value={password}
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

      <div>
        <label
          htmlFor="password-reset-confirm-password"
          className="text-sm font-semibold"
        >
          Potvrdi novu lozinku
        </label>
        <div className="relative mt-2">
          <LockKeyhole
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
          <input
            id="password-reset-confirm-password"
            className={fieldClassName}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            required
            aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError();
            }}
          />
        </div>
        {confirmPassword && !passwordsMatch ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            Lozinke se ne podudaraju.
          </p>
        ) : null}
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
        disabled={isLoading || isResetInvalid}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {isLoading ? 'Promjena lozinke...' : 'Sačuvaj novu lozinku'}
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
          onClick={backToLogin}
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Nazad na prijavu
        </button>
      </div>
    </form>
  );
}
