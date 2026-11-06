import type { Metadata } from 'next';
import { AdminUsersView } from '@/features/moderation/components/admin-users-view';

export const metadata: Metadata = { title: 'Korisnici' };

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
