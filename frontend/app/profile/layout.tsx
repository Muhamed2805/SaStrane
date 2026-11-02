import type { Metadata } from 'next';
import { PRIVATE_PAGE } from '@/lib/site';

// The page is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'Moj profil',
  robots: PRIVATE_PAGE,
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
