import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div
      className="space-y-8"
      aria-label="Učitavanje sadržaja"
      aria-busy="true"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
        <Skeleton className="h-5 w-full max-w-md rounded-lg" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <Skeleton className="mt-5 h-6 w-4/5 rounded-lg" />
            <Skeleton className="mt-3 h-4 w-full rounded-md" />
            <Skeleton className="mt-2 h-4 w-2/3 rounded-md" />
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
