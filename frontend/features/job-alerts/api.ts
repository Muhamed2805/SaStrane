import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type JobAlert = Schemas['JobAlertDto'];
export type CreateJobAlertPayload = Schemas['CreateJobAlertDto'];

// The API refuses more alerts per user.
export const MAX_JOB_ALERTS = 10;

export const jobAlertsApi = {
  // Newest first.
  getAll: () => authRequest<JobAlert[]>('/job-alerts'),

  create: (payload: CreateJobAlertPayload) =>
    authRequest<JobAlert>('/job-alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    authRequest<void>(`/job-alerts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
