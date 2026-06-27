import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount, error) => {
        if (!navigator.onLine) {
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
