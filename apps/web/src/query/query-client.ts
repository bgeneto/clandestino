import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api-client.js';
import { getOnlineStatus } from '../lib/online-status.js';

export function createAppQueryClient(): QueryClient {
  let client!: QueryClient;
  const mutationCache = new MutationCache({
    onSettled: (_data, error) => {
      if (error === null) {
        void client.invalidateQueries({ refetchType: 'active' });
      }
    },
  });

  client = new QueryClient({
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24,
        retry: (failureCount, error) => {
          if (!getOnlineStatus()) {
            return false;
          }

          if (error instanceof ApiError && error.status === 404) {
            return false;
          }

          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }

          if (error instanceof TypeError) {
            return failureCount < 1;
          }

          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });

  return client;
}

export const queryClient = createAppQueryClient();
