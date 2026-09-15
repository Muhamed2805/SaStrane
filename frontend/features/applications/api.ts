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

export const applicationsApi = {
  apply: (payload: CreateApplicationPayload, token: string) =>
    apiRequest<ApplicationFromApi>("/applications", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  getMyApplications: (token: string) =>
    apiRequest<ApplicationFromApi[]>("/applications/my", {
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
