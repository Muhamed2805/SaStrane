'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/features/auth/store';
import { cn } from '@/lib/utils';
import { statsQuery } from '../queries';

const SECTIONS = [
  { href: '/admin', label: 'Pregled' },
  { href: '/admin/reports', label: 'Prijave' },
  { href: '/admin/users', label: 'Korisnici' },
  { href: '/admin/listings', label: 'Oglasi' },
];

// The frame of every admin page. Only admins see what is inside: the API
// checks it again on every request.
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, status, openAuthModal } = useAuthStore();
  const pathname = usePathname();
  const isAdmin = Boolean(user?.isAdmin);
  const stats = useQuery({
    ...statsQuery(user?.id ?? ''),
    enabled: isAdmin,
  });

  if (status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-white px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold">
          Stranica je samo za administratore
        </h1>
        {!user ? (
          <button
            type="button"
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            onClick={openAuthModal}
          >
            Prijavi se
          </button>
        ) : null}
      </div>
    );
  }

  const openReports = stats.data?.openReports ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Administracija
        </p>
        <nav
          className="mt-4 overflow-x-auto border-b"
          aria-label="Administracija"
        >
          <div className="flex min-w-max gap-7">
            {SECTIONS.map((section) => {
              const active = pathname === section.href;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {section.label}
                  {section.href === '/admin/reports' && openReports > 0 ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] text-white">
                      {openReports}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
