import { Skeleton } from '@/components/ui/skeleton';

export function ListingCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mt-5 h-5 w-4/5" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}
