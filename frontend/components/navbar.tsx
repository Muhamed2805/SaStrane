'use client';

import Link from 'next/link';
import { useAuthStore } from '@/features/auth/store';

const NavLink = ({ href, label }: { href: string; label: string }) => {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
      {label}
    </Link>
  );
};

export function Navbar() {
  const { user, logout, openAuthModal } = useAuthStore();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          SaStrane
        </Link>

        <nav className="flex items-center gap-4">
          <NavLink href="/" label="Oglasi" />
          <NavLink href="/inbox" label="Inbox" />

          {user ? (
            <div className="flex items-center gap-3">
              <NavLink href="/listings/create" label="+ Novi oglas" />
              <span className="text-sm text-muted-foreground">{user.fullName}</span>
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={logout}
              >
                Odjavi se
              </button>
            </div>
          ) : (
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={openAuthModal}
            >
              Prijava
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}