import { formatDate } from "@/lib/format-date";
import type { ApplicationFromApi, ApplicationStatus } from "../api";
import { ApplicationStatusBadge } from "./application-status-badge";

type ListingSummary = {
  title: string;
  category: string;
  location: string;
};

type ReceivedApplicationCardProps = {
  application: ApplicationFromApi;
  listing?: ListingSummary;
  isUpdating: boolean;
  onStatusUpdate: (
    id: string,
    status: Extract<ApplicationStatus, "ACCEPTED" | "REJECTED">,
  ) => void;
};

export function ReceivedApplicationCard({
  application,
  listing,
  isUpdating,
  onStatusUpdate,
}: ReceivedApplicationCardProps) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {listing && (
            <>
              <p className="font-medium">{listing.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listing.category} · {listing.location}
              </p>
            </>
          )}
          {application.executor && (
            <p className={listing ? "mt-2 text-sm" : "text-sm font-medium"}>
              {application.executor.fullName}{" "}
              <span className="font-normal text-muted-foreground">
                ({application.executor.email})
              </span>
            </p>
          )}
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm">{application.message}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {application.proposedPrice && (
          <span>Predložena cijena: {application.proposedPrice}</span>
        )}
        <span>Primljeno: {formatDate(application.createdAt)}</span>
      </div>

      {application.status === "PENDING" && (
        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            disabled={isUpdating}
            type="button"
            onClick={() => onStatusUpdate(application.id, "ACCEPTED")}
          >
            {isUpdating ? "Ažuriram..." : "Prihvati"}
          </button>
          <button
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            disabled={isUpdating}
            type="button"
            onClick={() => onStatusUpdate(application.id, "REJECTED")}
          >
            Odbij
          </button>
        </div>
      )}
    </article>
  );
}
