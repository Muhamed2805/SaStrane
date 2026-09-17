'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { BrandLogo } from './brand-logo';

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
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
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
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
      <div className="site-container flex h-16 items-center justify-between">
        <BrandLogo />

        <nav className="hidden items-center gap-7 md:flex">
          <NavLink href="/" label="Početna" />
          <NavLink href="/" label="Pronađi posao" />
          {user ? <NavLink href="/inbox" label="Moje prijave" /> : null}

          {user ? (
            <div className="flex items-center gap-4 border-l pl-6">
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-32 truncate">{user.fullName}</span>
              </Link>
              <button
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={logout}
              >
                Odjavi se
              </button>
              <Link
                href="/listings/create"
                className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-dark"
              >
                Objavi oglas
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-4 border-l pl-6">
              <button
                className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                onClick={openAuthModal}
              >
                Prijava
              </button>
              <button
                className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-dark"
                onClick={openAuthModal}
              >
                Objavi oglas
              </button>
            </div>
          )}
        </nav>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={isMenuOpen ? 'Zatvori meni' : 'Otvori meni'}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
        >
          {isMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {isMenuOpen && (
        <nav
          id="mobile-navigation"
          className="site-container flex flex-col gap-4 border-t py-5 md:hidden"
        >
          <NavLink href="/" label="Početna" onClick={closeMenu} />
          <NavLink href="/" label="Pronađi posao" onClick={closeMenu} />

          {user ? (
            <>
              <NavLink href="/inbox" label="Moje prijave" onClick={closeMenu} />
              <NavLink
                href="/profile"
                label={user.fullName}
                onClick={closeMenu}
              />
              <Link
                href="/listings/create"
                onClick={closeMenu}
                className="rounded-lg bg-brand-orange px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Objavi oglas
              </Link>
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
            <>
              <button
                className="py-1 text-left text-sm font-medium text-foreground"
                onClick={() => {
                  closeMenu();
                  openAuthModal();
                }}
              >
                Prijava
              </button>
              <button
                className="rounded-lg bg-brand-orange px-4 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  closeMenu();
                  openAuthModal();
                }}
              >
                Objavi oglas
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
