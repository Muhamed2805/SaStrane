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

export const MAX_DETAILS_LENGTH = 1000;
export const REPORTS_PAGE_SIZE = 20;

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam ili reklama',
  SCAM: 'Prevara ili sumnjiva ponuda',
  INAPPROPRIATE: 'Neprikladan sadržaj',
  OTHER: 'Nešto drugo',
};

export const moderationApi = {
  // Answers 204 without a body.
  report: (payload: CreateReportPayload) =>
    authRequest<null>('/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // The routes below are for admins only.
  getReports: (status: ReportStatus, page: number) =>
    authRequest<ReportsPage>(
      `/admin/reports?status=${status}&page=${page}&limit=${REPORTS_PAGE_SIZE}`,
    ),

  handle: (id: string, status: HandledStatus) =>
    authRequest<Report>(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteListing: (listingId: string) =>
    authRequest<null>(`/admin/listings/${listingId}`, { method: 'DELETE' }),

  suspend: (userId: string) =>
    authRequest<null>(`/admin/users/${userId}/suspend`, { method: 'POST' }),

  unsuspend: (userId: string) =>
    authRequest<null>(`/admin/users/${userId}/unsuspend`, { method: 'POST' }),
};
