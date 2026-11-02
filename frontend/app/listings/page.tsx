import { ListingsFeed } from '@/features/listings/components/listings-feed';
import {
  isListingCategory,
  isListingLocation,
} from '@/features/listings/constants';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; location?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : '';
  // An unknown code in the URL turns its filter off.
  const category = isListingCategory(params.category)
    ? params.category
    : undefined;
  const location = isListingLocation(params.location)
    ? params.location
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-primary">Otvoreni poslovi</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Pronađi priliku blizu sebe
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pregledaj lokalne poslove, filtriraj ih prema svojim vještinama i
          pošalji prijavu u nekoliko koraka.
        </p>
      </div>

      <ListingsFeed
        initialQuery={query}
        initialCategory={category}
        initialLocation={location}
      />
    </div>
  );
}
