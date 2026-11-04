'use client';

import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

export const fieldClassName =
  'h-12 w-full rounded-lg border bg-background pr-4 pl-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/10 aria-invalid:border-red-400';

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  hint?: string;
  error?: string | null;
};

// A password field with a button that shows what was typed.
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength = 1,
  hint,
  error,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <div className="relative mt-2">
        <LockKeyhole
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
          aria-hidden="true"
        />
        <input
          id={id}
          className={`${fieldClassName} pr-12`}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          minLength={minLength}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={visible ? 'Sakrij lozinku' : 'Prikaži lozinku'}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
