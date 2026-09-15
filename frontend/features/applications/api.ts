import { apiRequest } from "@/lib/api-client";

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
  apply: (payload: CreateApplicationPayload, token: string) =>
    apiRequest<ApplicationFromApi>("/applications", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  getAppliedListingIds: (token: string) =>
    apiRequest<string[]>("/applications/my/listing-ids", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getMyApplications: (token: string, params: ApplicationsPageParams = {}) =>
    apiRequest<ApplicationsPage>(`/applications/my${pageQuery(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getReceivedApplications: (
    token: string,
    params: ApplicationsPageParams = {},
  ) =>
    apiRequest<ApplicationsPage>(`/applications/received${pageQuery(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getForListing: (listingId: string, token: string) =>
    apiRequest<ApplicationFromApi[]>(`/applications/listing/${listingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateStatus: (
    id: string,
    payload: UpdateApplicationStatusPayload,
    token: string,
  ) =>
    apiRequest<ApplicationFromApi>(`/applications/${id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
};
