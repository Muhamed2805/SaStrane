import { Skeleton } from '@/components/ui/skeleton';

export function ApplicationCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="w-full space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-20 w-full rounded-xl" />
      <div className="mt-4 flex gap-3">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}
