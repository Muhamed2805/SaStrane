'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import {
  applicationsApi,
  type ApplicationStatus,
  type ListingApplication,
} from '../api';
import { ApplicationCardSkeleton } from './application-card-skeleton';
import { ReceivedApplicationCard } from './received-application-card';

type ListingApplicationsProps = {
  listingId: string;
  clientId: string;
};

type DecidedStatus = Extract<ApplicationStatus, 'ACCEPTED' | 'REJECTED'>;

export function ListingApplications({
  listingId,
  clientId,
}: ListingApplicationsProps) {
  const user = useAuthStore((state) => state.user);
  const [applications, setApplications] = useState<ListingApplication[]>([]);
  const [reloadCount, setReloadCount] = useState(0);
  const [loadResult, setLoadResult] = useState<{
    key: string;
    error: string | null;
  } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const isOwner = user?.id === clientId;
  // Identifies the current load. Another listing or a retry gets a new key,
  // so the skeleton shows instead of stale data until that load finishes.
  const loadKey = isOwner ? `${listingId}:${reloadCount}` : null;
  const isLoading = loadKey !== null && loadResult?.key !== loadKey;
  const error =
    loadKey !== null && loadResult?.key === loadKey ? loadResult.error : null;

  useEffect(() => {
    if (!loadKey) return;

    let ignore = false;
    applicationsApi
      .getForListing(listingId)
      .then((items) => {
        if (ignore) return;
        setApplications(items);
        setLoadResult({ key: loadKey, error: null });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setLoadResult({
          key: loadKey,
          error: err instanceof Error ? err.message : 'Prijave nisu dostupne.',
        });
      });

    return () => {
      ignore = true;
    };
  }, [loadKey, listingId]);

  if (!isOwner) return null;

  const handleStatusUpdate = async (id: string, status: DecidedStatus) => {
    setUpdatingId(id);
    try {
      const updated = await applicationsApi.updateStatus(id, { status });
      setApplications((current) =>
        current.map((application) =>
          application.id === updated.id ? updated : application,
        ),
      );
      toast.success(
        status === 'ACCEPTED'
          ? 'Prijava je prihvaćena.'
          : 'Prijava je odbijena.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status nije ažuriran.');
    } finally {
      setUpdatingId(null);
    }
  };

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

      {!isLoading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <p role="alert">{error}</p>
          <button
            className="mt-3 underline"
            type="button"
            onClick={() => setReloadCount((count) => count + 1)}
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
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}
    </section>
  );
}
