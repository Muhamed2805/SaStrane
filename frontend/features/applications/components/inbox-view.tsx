"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store";
import { formatDate } from "@/lib/format-date";
import { applicationsApi, type ApplicationFromApi } from "../api";
import { ApplicationStatusBadge } from "./application-status-badge";
import { ApplicationCardSkeleton } from "./application-card-skeleton";
import { ReceivedApplicationCard } from "./received-application-card";

const PAGE_SIZE = 10;

function appendUnique(
  current: ApplicationFromApi[],
  incoming: ApplicationFromApi[],
) {
  const existingIds = new Set(current.map((application) => application.id));
  return [
    ...current,
    ...incoming.filter((application) => !existingIds.has(application.id)),
  ];
}

export function InboxView() {
  const { user, token, openAuthModal } = useAuthStore();
  const [myApplications, setMyApplications] = useState<ApplicationFromApi[]>(
    [],
  );
  const [receivedApplications, setReceivedApplications] = useState<
    ApplicationFromApi[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [myPage, setMyPage] = useState(1);
  const [myTotalPages, setMyTotalPages] = useState(1);
  const [receivedPage, setReceivedPage] = useState(1);
  const [receivedTotalPages, setReceivedTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState<"my" | "received" | null>(
    null,
  );

  const loadInbox = useCallback(async () => {
    if (!user || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [myPageData, receivedPageData] = await Promise.all([
        applicationsApi.getMyApplications(token, { page: 1, limit: PAGE_SIZE }),
        applicationsApi.getReceivedApplications(token, {
          page: 1,
          limit: PAGE_SIZE,
        }),
      ]);

      setMyApplications(myPageData.items);
      setMyPage(myPageData.page);
      setMyTotalPages(myPageData.totalPages);
      setReceivedApplications(receivedPageData.items);
      setReceivedPage(receivedPageData.page);
      setReceivedTotalPages(receivedPageData.totalPages);
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

  const loadMoreMyApplications = async () => {
    if (!token || myPage >= myTotalPages) return;

    setLoadingMore("my");
    try {
      const nextPage = await applicationsApi.getMyApplications(token, {
        page: myPage + 1,
        limit: PAGE_SIZE,
      });
      setMyApplications((current) => appendUnique(current, nextPage.items));
      setMyPage(nextPage.page);
      setMyTotalPages(nextPage.totalPages);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingMore(null);
    }
  };

  const loadMoreReceivedApplications = async () => {
    if (!token || receivedPage >= receivedTotalPages) return;

    setLoadingMore("received");
    try {
      const nextPage = await applicationsApi.getReceivedApplications(token, {
        page: receivedPage + 1,
        limit: PAGE_SIZE,
      });
      setReceivedApplications((current) =>
        appendUnique(current, nextPage.items),
      );
      setReceivedPage(nextPage.page);
      setReceivedTotalPages(nextPage.totalPages);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingMore(null);
    }
  };

  const handleStatusUpdate = async (
    id: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    if (!token) return;

    setUpdatingId(id);
    try {
      const updated = await applicationsApi.updateStatus(id, { status }, token);
      setReceivedApplications((current) =>
        current.map((application) =>
          application.id === updated.id
            ? { ...application, ...updated }
            : application,
        ),
      );
      toast.success(
        status === "ACCEPTED"
          ? "Prijava je prihvaćena."
          : "Prijava je odbijena.",
      );
    } catch (err) {
      toast.error((err as Error).message);
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
                      {app.proposedPrice && (
                        <span>Predložena cijena: {app.proposedPrice}</span>
                      )}
                      <span>Poslano: {formatDate(app.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {myPage < myTotalPages && (
                  <button
                    className="h-10 w-full rounded-md border text-sm hover:bg-muted disabled:opacity-50"
                    disabled={loadingMore !== null}
                    type="button"
                    onClick={loadMoreMyApplications}
                  >
                    {loadingMore === "my" ? "Učitavam..." : "Učitaj još"}
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Primljene prijave</h2>

            {receivedApplications.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Nema prijava na tvoje oglase.{" "}
                <Link
                  href="/listings/create"
                  className="underline hover:text-foreground"
                >
                  Objavi novi oglas
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedApplications.map((app) => (
                  <ReceivedApplicationCard
                    key={app.id}
                    application={app}
                    listing={app.listing}
                    isUpdating={updatingId === app.id}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))}
                {receivedPage < receivedTotalPages && (
                  <button
                    className="h-10 w-full rounded-md border text-sm hover:bg-muted disabled:opacity-50"
                    disabled={loadingMore !== null}
                    type="button"
                    onClick={loadMoreReceivedApplications}
                  >
                    {loadingMore === "received" ? "Učitavam..." : "Učitaj još"}
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
