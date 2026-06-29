import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api-client.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount, error) => {
        if (!navigator.onLine) {
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
