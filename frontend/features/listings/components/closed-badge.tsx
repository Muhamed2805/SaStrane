import { Lock } from 'lucide-react';
import type { ListingStatus } from '../api';

// Shown on jobs that take no new applications. Open jobs need no badge.
export function ClosedBadge({ status }: { status: ListingStatus }) {
  if (status !== 'CLOSED') return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <Lock className="size-3" aria-hidden="true" />
      Zatvoren
    </span>
  );
}
