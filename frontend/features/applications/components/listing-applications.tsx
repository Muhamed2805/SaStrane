'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store';
import { useDecideApplication } from '../hooks';
import { listingApplicationsQuery } from '../queries';
import { ApplicationCardSkeleton } from './application-card-skeleton';
import { ReceivedApplicationCard } from './received-application-card';

type ListingApplicationsProps = {
  listingId: string;
  clientId: string;
};

export function ListingApplications({
  listingId,
  clientId,
}: ListingApplicationsProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const isOwner = userId === clientId;
  const {
    data: applications = [],
    error,
    isPending,
    refetch,
  } = useQuery({
    ...listingApplicationsQuery(userId ?? '', listingId),
    enabled: isOwner,
  });
  const { decide, updatingId } = useDecideApplication(userId ?? '');

  if (!isOwner) return null;

  const isLoading = isPending && !error;

  return (
    <section
      className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm sm:p-8"
      aria-labelledby="listing-applications-title"
    >
      <div>
        <h2 id="listing-applications-title" className="text-lg font-semibold">
          Pristigle prijave
        </h2>
        {!isLoading && !error && (
          <p className="mt-1 text-sm text-muted-foreground">
            {applications.length === 1
              ? '1 prijava na ovaj oglas'
              : `${applications.length} prijava na ovaj oglas`}
          </p>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <ApplicationCardSkeleton />
          <ApplicationCardSkeleton />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <p role="alert">{error.message}</p>
          <button
            className="mt-3 underline"
            type="button"
            onClick={() => void refetch()}
          >
            Pokušaj ponovo
          </button>
        </div>
      )}

      {!isLoading && !error && applications.length === 0 && (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Još nema prijava na ovaj oglas.
        </div>
      )}

      {!isLoading && !error && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((application) => (
            <ReceivedApplicationCard
              key={application.id}
              application={application}
              isUpdating={updatingId === application.id}
              onStatusUpdate={decide}
            />
          ))}
        </div>
      )}
    </section>
  );
}
