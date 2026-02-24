import Link from "next/link";
import type { Listing } from "../types";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/listings/${listing.id}`} className="block">
      <div className="rounded-lg border p-4 hover:bg-muted/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">{listing.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {listing.category} · {listing.location}
            </div>
          </div>

          {listing.budgetText ? (
            <div className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs">
              {listing.budgetText}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}