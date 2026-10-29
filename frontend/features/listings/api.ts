import { authRequest } from "@/features/auth/session";
import type { components, operations } from "@/lib/api-schema";
import { apiRequest } from "@/lib/api-client";

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components["schemas"];

// A job as lists show it, without the description.
export type ListingSummary = Schemas["ListingSummaryDto"];
export type Listing = Schemas["ListingDto"];
export type ListingsPage = Schemas["ListingsPageDto"];
export type GetAllListingsParams = NonNullable<
  operations["listings_getAll"]["parameters"]["query"]
>;
export type CreateListingPayload = Schemas["CreateListingDto"];
export type UpdateListingPayload = Schemas["UpdateListingDto"];

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
    apiRequest<Listing>(`/listings/${id}`, { cache: "no-store" }),

  create: (payload: CreateListingPayload) =>
    authRequest<Listing>("/listings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateListingPayload) =>
    authRequest<Listing>(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Answers 204 without a body.
  delete: (id: string) =>
    authRequest<null>(`/listings/${id}`, { method: "DELETE" }),
};
