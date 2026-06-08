import Link from 'next/link';
import type { ListingFromApi } from '../api';

export function ListingCard({ listing }: { listing: ListingFromApi }) {
  return (
    <Link href={`/listings/${listing.id}`} className="block">
      <div className="rounded-lg border p-4 hover:bg-muted/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">{listing.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {listing.category} · {listing.location}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {listing.client.fullName}
            </div>
          </div>

          {listing.budget ? (
            <div className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs">
              {listing.budget}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}