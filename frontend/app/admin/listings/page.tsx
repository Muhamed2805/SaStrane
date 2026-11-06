import type { Metadata } from 'next';
import { AdminListingsView } from '@/features/moderation/components/admin-listings-view';

export const metadata: Metadata = { title: 'Oglasi' };

export default function AdminListingsPage() {
  return <AdminListingsView />;
}
