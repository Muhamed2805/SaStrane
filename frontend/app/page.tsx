import { ListingsFeed } from "@/features/listings/components/listings-feed";

export default function HomePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Oglasi</h1>
      <p className="text-sm text-muted-foreground">
        Pronađi brze poslove u svojoj blizini.
      </p>

      <div className="mt-6">
        <ListingsFeed />
      </div>
    </div>
  );
}