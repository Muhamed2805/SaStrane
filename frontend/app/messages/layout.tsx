import type { Metadata } from 'next';
import { PRIVATE_PAGE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Poruke',
  robots: PRIVATE_PAGE,
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
