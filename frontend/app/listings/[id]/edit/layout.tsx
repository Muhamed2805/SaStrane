import type { Metadata } from 'next';
import { PRIVATE_PAGE } from '@/lib/site';

// The page is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'Uredi oglas',
  robots: PRIVATE_PAGE,
};

export default function EditListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
