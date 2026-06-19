import { listingsApi } from '@/features/listings/api';
import { ListingActions } from '@/features/listings/components/listing-actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailsPage({ params }: PageProps) {
  const { id } = await params;

  let listing;
  try {
    listing = await listingsApi.getById(id);
  } catch {
    return (
      <div className="rounded-lg border p-4 text-sm">
        Oglas nije pronađen.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {listing.category} · {listing.location}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Objavio: {listing.client.fullName}
        </p>
      </div>

      {/* Budget */}
      {listing.budget ? (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Budžet</div>
          <div className="mt-1 font-medium">{listing.budget}</div>
        </div>
      ) : null}

      {/* Description */}
      {listing.description ? (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Opis</div>
          <p className="mt-2 text-sm">{listing.description}</p>
        </div>
      ) : null}

      {/* Actions */}
      <ListingActions listingId={listing.id} clientId={listing.client.id} />
    </div>
  );
}