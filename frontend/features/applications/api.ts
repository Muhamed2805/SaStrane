import { authRequest } from "@/features/auth/session";

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type ApplicationFromApi = {
  id: string;
  listingId: string;
  message: string;
  proposedPrice: string | null;
  status: ApplicationStatus;
  createdAt: string;
  listing?: {
    title: string;
    category: string;
    location: string;
  };
  executor?: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type CreateApplicationPayload = {
  listingId: string;
  message: string;
  proposedPrice?: string;
};

export type UpdateApplicationStatusPayload = {
  status: "ACCEPTED" | "REJECTED";
};

export type ApplicationsPage = {
  items: ApplicationFromApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ApplicationsPageParams = {
  page?: number;
  limit?: number;
};

function pageQuery(params: ApplicationsPageParams): string {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const applicationsApi = {
  apply: (payload: CreateApplicationPayload) =>
    authRequest<ApplicationFromApi>("/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAppliedListingIds: () =>
    authRequest<string[]>("/applications/my/listing-ids"),

  getMyApplications: (params: ApplicationsPageParams = {}) =>
    authRequest<ApplicationsPage>(`/applications/my${pageQuery(params)}`),

  getReceivedApplications: (params: ApplicationsPageParams = {}) =>
    authRequest<ApplicationsPage>(`/applications/received${pageQuery(params)}`),

  getForListing: (listingId: string) =>
    authRequest<ApplicationFromApi[]>(`/applications/listing/${listingId}`),

  updateStatus: (id: string, payload: UpdateApplicationStatusPayload) =>
    authRequest<ApplicationFromApi>(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
