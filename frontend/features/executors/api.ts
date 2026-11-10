import { apiRequest } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

// The types come from the backend's openapi.json. See lib/api-schema.d.ts.
export type Executor = components['schemas']['ExecutorDto'];
export type ExecutorsPage = components['schemas']['ExecutorsPageDto'];
export type GetExecutorsParams = NonNullable<
  operations['users_getExecutors']['parameters']['query']
>;

export const executorsApi = {
  // Public: the list needs no sign-in.
  getAll: (params: GetExecutorsParams = {}, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.q) searchParams.set('q', params.q);
    if (params.skill) searchParams.set('skill', params.skill);
    if (params.location) searchParams.set('location', params.location);
    const query = searchParams.toString();
    return apiRequest<ExecutorsPage>(`/users${query ? `?${query}` : ''}`, {
      cache: 'no-store',
      signal,
    });
  },
};
