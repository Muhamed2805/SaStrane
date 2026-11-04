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
export type ListingCategory = Schemas["ListingCategory"];
export type ListingLocation = Schemas["ListingLocation"];
export type ListingStatus = Schemas["ListingStatus"];
export type ListingPhoto = Schemas["ListingPhotoDto"];

export const listingsApi = {
  getAll: (params: GetAllListingsParams = {}, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.clientId) searchParams.set("clientId", params.clientId);
    if (params.q) searchParams.set("q", params.q);
    if (params.category) searchParams.set("category", params.category);
    if (params.location) searchParams.set("location", params.location);
    if (params.status) searchParams.set("status", params.status);
    const query = searchParams.toString();
    return apiRequest<ListingsPage>(`/listings${query ? `?${query}` : ""}`, {
      signal,
    });
  },

  getById: (id: string, signal?: AbortSignal) =>
    apiRequest<Listing>(`/listings/${id}`, { cache: "no-store", signal }),

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

  // A closed job takes no new applications.
  updateStatus: (id: string, status: ListingStatus) =>
    authRequest<Listing>(`/listings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Answers 204 without a body.
  delete: (id: string) =>
    authRequest<null>(`/listings/${id}`, { method: "DELETE" }),

  // The backend resizes the photo and converts it to WebP.
  addPhoto: (listingId: string, file: File) => {
    const body = new FormData();
    body.append("photo", file);
    return authRequest<ListingPhoto>(`/listings/${listingId}/photos`, {
      method: "POST",
      body,
    });
  },

  // Answers 204 without a body.
  deletePhoto: (listingId: string, photoId: string) =>
    authRequest<null>(`/listings/${listingId}/photos/${photoId}`, {
      method: "DELETE",
    }),

  // photoIds lists every photo of the job once. The first is the cover.
  reorderPhotos: (listingId: string, photoIds: string[]) =>
    authRequest<ListingPhoto[]>(`/listings/${listingId}/photos/order`, {
      method: "PUT",
      body: JSON.stringify({ photoIds }),
    }),
};
