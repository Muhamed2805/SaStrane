import type { Metadata } from 'next';
import { AdminReportsView } from '@/features/moderation/components/admin-reports-view';
import { PRIVATE_PAGE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Prijave',
  robots: PRIVATE_PAGE,
};

export default function AdminPage() {
  return <AdminReportsView />;
}
