import { MOCK_LISTINGS } from "@/features/listings/mock";
import { ListingActions } from "@/features/listings/components/listing-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const listing = MOCK_LISTINGS.find(
    (x) => String(x.id) === String(id)
  );

  if (!listing) {
    return (
      <div className="rounded-lg border p-4 text-sm">
        Oglas nije pronađen. (id: {String(id)})
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
      </div>

      {/* Budget */}
      {listing.budgetText ? (
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Budžet</div>
          <div className="mt-1 font-medium">{listing.budgetText}</div>
        </div>
      ) : null}

      {/* Description */}
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Opis</div>
        <p className="mt-2 text-sm">
          (MVP) Ovdje će doći opis oglasa. Za sada koristimo mock data.
        </p>
      </div>

      {/* Actions */}
      
        <ListingActions listingId={String(listing.id)} />
    </div>
  );
}