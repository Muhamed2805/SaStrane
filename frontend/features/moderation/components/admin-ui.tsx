'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Waits until the value stops changing, so typing sends one request.
export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'danger' | 'primary' | 'warning';
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        tone === 'danger' && 'bg-red-50 text-red-700',
        tone === 'primary' && 'bg-primary/10 text-primary',
        tone === 'warning' && 'bg-amber-50 text-amber-700',
      )}
    >
      {children}
    </span>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="relative block w-full sm:max-w-sm">
      <span className="sr-only">{label}</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="h-10 w-full rounded-lg border bg-white pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
      />
    </label>
  );
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'h-9 rounded-full border px-4 text-xs font-semibold transition-colors',
            value === tab.id
              ? 'border-primary bg-primary text-white'
              : 'bg-white text-muted-foreground hover:border-primary/30 hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// The loading, error and empty states of a paged admin list.
export function ListState({
  isPending,
  error,
  isEmpty,
  emptyLabel,
  onRetry,
  children,
}: {
  isPending: boolean;
  error: string | null | undefined;
  isEmpty: boolean;
  emptyLabel: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold">Podaci nisu učitani</p>
        <p className="mt-1 text-red-600">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 font-semibold underline"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Pokušaj ponovo
        </button>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <p className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return <>{children}</>;
}

export function LoadMore({
  hasMore,
  isLoading,
  onClick,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold text-muted-foreground hover:border-primary/30 hover:text-primary disabled:opacity-50"
    >
      {isLoading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      Učitaj još
    </button>
  );
}
