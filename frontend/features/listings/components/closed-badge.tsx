import { Lock } from 'lucide-react';
import type { ListingStatus } from '../api';

// Shown on jobs that take no new applications. Open jobs need no badge. A
// closed job that kept its expiry time expired by itself.
export function ClosedBadge({
  status,
  expiresAt,
}: {
  status: ListingStatus;
  expiresAt?: string | null;
}) {
  if (status !== 'CLOSED') return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <Lock className="size-3" aria-hidden="true" />
      {expiresAt ? 'Istekao' : 'Zatvoren'}
    </span>
  );
}
