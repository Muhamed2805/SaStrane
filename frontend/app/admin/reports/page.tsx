import type { Metadata } from 'next';
import { AdminReportsView } from '@/features/moderation/components/admin-reports-view';

export const metadata: Metadata = { title: 'Prijave' };

export default function AdminReportsPage() {
  return <AdminReportsView />;
}
