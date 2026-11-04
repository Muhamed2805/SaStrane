import type { Metadata } from 'next';
import { PRIVATE_PAGE } from '@/lib/site';

// The page is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'Postavke naloga',
  robots: PRIVATE_PAGE,
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
