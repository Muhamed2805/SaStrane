"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store";
import { listingsApi } from "@/features/listings/api";
import { formatDate } from "@/lib/format-date";
import { applicationsApi, type ApplicationFromApi } from "../api";
import { ApplicationStatusBadge } from "./application-status-badge";
import { ApplicationCardSkeleton } from "./application-card-skeleton";

type ReceivedApplication = ApplicationFromApi & {
  listingTitle: string;
  listingCategory: string;
  listingLocation: string;
};

export function InboxView() {
  const { user, token, openAuthModal } = useAuthStore();
  const [myApplications, setMyApplications] = useState<ApplicationFromApi[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<ReceivedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!user || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [myApps, myListingsPage] = await Promise.all([
        applicationsApi.getMyApplications(token),
        listingsApi.getAll({ clientId: user.id, limit: 100 }),
      ]);

      const myListings = myListingsPage.items;

      const receivedGroups = await Promise.all(
        myListings.map(async (listing) => {
          const apps = await applicationsApi.getForListing(listing.id, token);
          return apps.map((app) => ({
            ...app,
            listingTitle: listing.title,
            listingCategory: listing.category,
            listingLocation: listing.location,
          }));
        }),
      );

      setMyApplications(myApps);
      setReceivedApplications(
        receivedGroups
          .flat()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    if (user && token) {
      loadInbox();
    } else {
      setIsLoading(false);
    }
  }, [user, token, loadInbox]);

  const handleStatusUpdate = async (id: string, status: "ACCEPTED" | "REJECTED") => {
    if (!token) return;

    setUpdatingId(id);
    try {
      await applicationsApi.updateStatus(id, { status }, token);
      toast.success(status === "ACCEPTED" ? "Prijava je prihvaćena." : "Prijava je odbijena.");
      await loadInbox();
    } catch (err) {
      toast.error((err as Error).message);
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user || !token) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Moraš biti prijavljen da vidiš inbox.
        </p>
        <button
          className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-90"
          onClick={openAuthModal}
        >
          Prijavi se
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prati svoje prijave i upravljaj primljenim ponudama.
        </p>
      </div>

      {isLoading && (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Moje prijave</h2>
            <div className="space-y-3">
              <ApplicationCardSkeleton />
              <ApplicationCardSkeleton />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Primljene prijave</h2>
            <div className="space-y-3">
              <ApplicationCardSkeleton />
              <ApplicationCardSkeleton />
            </div>
          </section>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Greška: {error}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Moje prijave</h2>

            {myApplications.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Još nisi aplicirao ni na jedan oglas.{" "}
                <Link href="/" className="underline hover:text-foreground">
                  Pregledaj oglase
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myApplications.map((app) => (
                  <div key={app.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/listings/${app.listingId}`}
                          className="font-medium hover:underline"
                        >
                          {app.listing?.title ?? `Oglas #${app.listingId}`}
                        </Link>
                        {app.listing && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {app.listing.category} · {app.listing.location}
                          </p>
                        )}
                      </div>
                      <ApplicationStatusBadge status={app.status} />
                    </div>

                    <p className="mt-3 text-sm">{app.message}</p>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {app.proposedPrice && <span>Predložena cijena: {app.proposedPrice}</span>}
                      <span>Poslano: {formatDate(app.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Primljene prijave</h2>

            {receivedApplications.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Nema prijava na tvoje oglase.{" "}
                <Link href="/listings/create" className="underline hover:text-foreground">
                  Objavi novi oglas
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedApplications.map((app) => (
                  <div key={app.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{app.listingTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {app.listingCategory} · {app.listingLocation}
                        </p>
                        {app.executor && (
                          <p className="mt-2 text-sm">
                            {app.executor.fullName}{" "}
                            <span className="text-muted-foreground">({app.executor.email})</span>
                          </p>
                        )}
                      </div>
                      <ApplicationStatusBadge status={app.status} />
                    </div>

                    <p className="mt-3 text-sm">{app.message}</p>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {app.proposedPrice && <span>Predložena cijena: {app.proposedPrice}</span>}
                      <span>Primljeno: {formatDate(app.createdAt)}</span>
                    </div>

                    {app.status === "PENDING" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                          disabled={updatingId === app.id}
                          onClick={() => handleStatusUpdate(app.id, "ACCEPTED")}
                        >
                          {updatingId === app.id ? "..." : "Prihvati"}
                        </button>
                        <button
                          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                          disabled={updatingId === app.id}
                          onClick={() => handleStatusUpdate(app.id, "REJECTED")}
                        >
                          Odbij
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
