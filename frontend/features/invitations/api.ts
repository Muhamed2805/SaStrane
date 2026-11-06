import { authRequest } from '@/features/auth/session';
import type { components } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
type Schemas = components['schemas'];

export type Invitation = Schemas['InvitationDto'];
// An invitation as the invited user sees it, with the job and the client.
export type ReceivedInvitation = Schemas['ReceivedInvitationDto'];
export type ReceivedInvitationsPage = Schemas['ReceivedInvitationsPageDto'];
// One of the client's open jobs and whether the user can be invited to it.
export type InvitationOption = Schemas['InvitationOptionDto'];
export type InvitationOptionState = Schemas['InvitationOptionState'];
export type CreateInvitationPayload = Schemas['CreateInvitationDto'];

// The API refuses more invitations to one job.
export const MAX_INVITATIONS_PER_LISTING = 20;

export const invitationsApi = {
  // Newest first, only invitations to open jobs.
  getReceived: (page: number, limit: number) =>
    authRequest<ReceivedInvitationsPage>(
      `/invitations?page=${page}&limit=${limit}`,
    ),

  getOptions: (executorId: string) =>
    authRequest<InvitationOption[]>(
      `/invitations/options?executorId=${encodeURIComponent(executorId)}`,
    ),

  invite: (payload: CreateInvitationPayload) =>
    authRequest<Invitation>('/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Answers 204 without a body.
  decline: (id: string) =>
    authRequest<null>(`/invitations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
