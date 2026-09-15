import { apiRequest } from "@/lib/api-client";

export type ListingFromApi = {
  id: string;
  title: string;
  category: string;
  location: string;
  budget: string | null;
  description?: string | null;
  createdAt: string;
  client: {
    id: string;
    fullName: string;
  };
};

export type ListingsPage = {
  items: ListingFromApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type GetAllListingsParams = {
  page?: number;
  limit?: number;
  clientId?: string;
  q?: string;
  category?: string;
  location?: string;
};

export type CreateListingPayload = {
  title: string;
  category: string;
  location: string;
  budget?: string;
  description?: string;
};

export type UpdateListingPayload = Partial<{
  title: string;
  category: string;
  location: string;
  budget: string | null;
  description: string | null;
}>;

export const listingsApi = {
  getAll: (params: GetAllListingsParams = {}, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.clientId) searchParams.set("clientId", params.clientId);
    if (params.q) searchParams.set("q", params.q);
    if (params.category) searchParams.set("category", params.category);
    if (params.location) searchParams.set("location", params.location);
    const query = searchParams.toString();
    return apiRequest<ListingsPage>(`/listings${query ? `?${query}` : ""}`, {
      signal,
    });
  },

  getById: (id: string) =>
    apiRequest<ListingFromApi>(`/listings/${id}`, { cache: "no-store" }),

  create: (payload: CreateListingPayload, token: string) =>
    apiRequest<ListingFromApi>("/listings", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateListingPayload, token: string) =>
    apiRequest<ListingFromApi>(`/listings/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  delete: (id: string, token: string) =>
    apiRequest<void>(`/listings/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
};
