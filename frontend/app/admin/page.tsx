import type { Metadata } from 'next';
import { AdminOverview } from '@/features/moderation/components/admin-overview';

export const metadata: Metadata = { title: 'Administracija' };

export default function AdminPage() {
  return <AdminOverview />;
}
