import type { Metadata } from 'next';
import {
  InboxView,
  type InboxTab,
} from '@/features/applications/components/inbox-view';
import { PRIVATE_PAGE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Radni prostor',
  robots: PRIVATE_PAGE,
};

const TABS: InboxTab[] = ['listings', 'applications', 'received', 'saved'];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const requestedTab = (await searchParams).tab;
  const initialTab = TABS.find((tab) => tab === requestedTab);

  return <InboxView initialTab={initialTab} />;
}
