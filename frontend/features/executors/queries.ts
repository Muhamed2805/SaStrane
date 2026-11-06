import { queryOptions } from '@tanstack/react-query';
import { executorsApi, type GetExecutorsParams } from './api';

// The list is public, so its keys are not scoped to the signed-in user.
export const executorKeys = {
  all: ['executors'] as const,
  list: (params: GetExecutorsParams) => [...executorKeys.all, params] as const,
};

export function executorsQuery(params: GetExecutorsParams) {
  return queryOptions({
    queryKey: executorKeys.list(params),
    queryFn: ({ signal }) => executorsApi.getAll(params, signal),
  });
}
