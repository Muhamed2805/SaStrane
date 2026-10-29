import { authRequest } from "@/features/auth/session";
import type { components, operations } from "@/lib/api-schema";

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components["schemas"];

export type ApplicationStatus = Schemas["ApplicationStatus"];
export type Application = Schemas["ApplicationDto"];
// The job an application belongs to.
export type ApplicationListing = Schemas["ApplicationListingDto"];
// An application as the executor who sent it sees it, with the job.
export type MyApplication = Schemas["MyApplicationDto"];
// An application as the job's client sees it, with the executor.
export type ListingApplication = Schemas["ListingApplicationDto"];
// An application in the client's inbox, with the executor and the job.
export type ReceivedApplication = Schemas["ReceivedApplicationDto"];
export type MyApplicationsPage = Schemas["MyApplicationsPageDto"];
export type ReceivedApplicationsPage = Schemas["ReceivedApplicationsPageDto"];
export type CreateApplicationPayload = Schemas["CreateApplicationDto"];
export type UpdateApplicationStatusPayload =
  Schemas["UpdateApplicationStatusDto"];
export type ApplicationsPageParams = NonNullable<
  operations["applications_getMy"]["parameters"]["query"]
>;

function pageQuery(params: ApplicationsPageParams): string {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const applicationsApi = {
  apply: (payload: CreateApplicationPayload) =>
    authRequest<Application>("/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAppliedListingIds: () =>
    authRequest<string[]>("/applications/my/listing-ids"),

  getMyApplications: (params: ApplicationsPageParams = {}) =>
    authRequest<MyApplicationsPage>(`/applications/my${pageQuery(params)}`),

  getReceivedApplications: (params: ApplicationsPageParams = {}) =>
    authRequest<ReceivedApplicationsPage>(
      `/applications/received${pageQuery(params)}`,
    ),

  getForListing: (listingId: string) =>
    authRequest<ListingApplication[]>(`/applications/listing/${listingId}`),

  updateStatus: (id: string, payload: UpdateApplicationStatusPayload) =>
    authRequest<ListingApplication>(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
