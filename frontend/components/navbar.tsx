'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';

const NavLink = ({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  );
};

export function Navbar() {
  const { user, logout, openAuthModal } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold" onClick={closeMenu}>
          SaStrane
        </Link>

        <nav className="hidden items-center gap-4 md:flex">
          <NavLink href="/" label="Oglasi" />
          <NavLink href="/inbox" label="Inbox" />

          {user ? (
            <div className="flex items-center gap-3">
              <NavLink href="/listings/create" label="+ Novi oglas" />
              <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
                {user.fullName}
              </Link>
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

        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={isMenuOpen ? 'Zatvori meni' : 'Otvori meni'}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen && (
        <nav className="flex flex-col gap-3 border-t px-4 py-4 md:hidden">
          <NavLink href="/" label="Oglasi" onClick={closeMenu} />
          <NavLink href="/inbox" label="Inbox" onClick={closeMenu} />

          {user ? (
            <>
              <NavLink href="/listings/create" label="+ Novi oglas" onClick={closeMenu} />
              <NavLink href="/profile" label={user.fullName} onClick={closeMenu} />
              <button
                className="py-1 text-left text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  closeMenu();
                  logout();
                }}
              >
                Odjavi se
              </button>
            </>
          ) : (
            <button
              className="py-1 text-left text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                closeMenu();
                openAuthModal();
              }}
            >
              Prijava
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
