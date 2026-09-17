import { ListingsFeed } from '@/features/listings/components/listings-feed';
import {
  LISTING_CATEGORIES,
  LISTING_LOCATIONS,
} from '@/features/listings/constants';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; location?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : '';
  const category = LISTING_CATEGORIES.find((item) => item === params.category);
  const location = LISTING_LOCATIONS.find((item) => item === params.location);

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
        initialCategory={category ?? 'Sve'}
        initialLocation={location ?? 'Sve'}
      />
    </div>
  );
}
