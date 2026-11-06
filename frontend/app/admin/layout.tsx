import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/features/moderation/components/admin-shell';
import { PRIVATE_PAGE } from '@/lib/site';

export const metadata: Metadata = {
  robots: PRIVATE_PAGE,
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
