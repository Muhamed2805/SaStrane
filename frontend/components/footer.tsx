import Link from 'next/link';
import { BrandLogo } from './brand-logo';

const footerGroups = [
  {
    title: 'Platforma',
    links: [
      { label: 'Pronađi posao', href: '/listings' },
      { label: 'Objavi oglas', href: '/listings/create' },
      { label: 'Moje prijave', href: '/inbox' },
    ],
  },
  {
    title: 'Moj račun',
    links: [
      { label: 'Profil', href: '/profile' },
      { label: 'Primljene prijave', href: '/inbox' },
      { label: 'Moji oglasi', href: '/inbox' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 bg-brand-navy text-slate-300">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <BrandLogo inverted />
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Lokalna platforma koja povezuje ljude kojima je potrebna pomoć sa
            pouzdanim izvođačima iz njihove blizine.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold text-white">{group.title}</h2>
            <ul className="mt-4 space-y-3">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="site-container py-5 text-xs text-slate-500">
          © {new Date().getFullYear()} SaStrane. Sva prava zadržana.
        </div>
      </div>
    </footer>
  );
}
