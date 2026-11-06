import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type ReportReason = Schemas['ReportReason'];
export type ReportStatus = Schemas['ReportStatus'];
export type Report = Schemas['ReportDto'];
export type ReportsPage = Schemas['ReportsPageDto'];
export type CreateReportPayload = Schemas['CreateReportDto'];
export type HandledStatus = Schemas['HandleReportDto']['status'];
export type AdminStats = Schemas['AdminStatsDto'];
export type AdminUser = Schemas['AdminUserDto'];
export type AdminUsersPage = Schemas['AdminUsersPageDto'];
export type AdminUserFilter = Schemas['AdminUserFilter'];
export type AdminListing = Schemas['AdminListingDto'];
export type AdminListingsPage = Schemas['AdminListingsPageDto'];
export type ListingStatus = Schemas['ListingStatus'];

export const MAX_DETAILS_LENGTH = 1000;
export const ADMIN_PAGE_SIZE = 20;

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam ili reklama',
  SCAM: 'Prevara ili sumnjiva ponuda',
  INAPPROPRIATE: 'Neprikladan sadržaj',
  OTHER: 'Nešto drugo',
};

// The query string of a paged admin list, without empty values.
function listQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE) });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
}

export const moderationApi = {
  // Answers 204 without a body.
  report: (payload: CreateReportPayload) =>
    authRequest<null>('/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // The routes below are for admins only.
  getStats: () => authRequest<AdminStats>('/admin/stats'),

  getReports: (status: ReportStatus, page: number) =>
    authRequest<ReportsPage>(`/admin/reports?${listQuery({ status, page })}`),

  handle: (id: string, status: HandledStatus) =>
    authRequest<Report>(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getUsers: (q: string, filter: AdminUserFilter | undefined, page: number) =>
    authRequest<AdminUsersPage>(
      `/admin/users?${listQuery({ q, filter, page })}`,
    ),

  suspend: (userId: string) =>
    authRequest<null>(`/admin/users/${userId}/suspend`, { method: 'POST' }),

  unsuspend: (userId: string) =>
    authRequest<null>(`/admin/users/${userId}/unsuspend`, { method: 'POST' }),

  getListings: (q: string, status: ListingStatus | undefined, page: number) =>
    authRequest<AdminListingsPage>(
      `/admin/listings?${listQuery({ q, status, page })}`,
    ),

  setListingStatus: (listingId: string, status: ListingStatus) =>
    authRequest<null>(`/admin/listings/${listingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteListing: (listingId: string) =>
    authRequest<null>(`/admin/listings/${listingId}`, { method: 'DELETE' }),
};
