import {
  InboxView,
  type InboxTab,
} from '@/features/applications/components/inbox-view';

const TABS: InboxTab[] = ['listings', 'applications', 'received'];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const requestedTab = (await searchParams).tab;
  const initialTab = TABS.find((tab) => tab === requestedTab);

  return <InboxView initialTab={initialTab} />;
}
