import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { queryClient } from './query-client.js';
import { queryPersister } from './persister.js';
import { QUERY_CACHE_BUSTER, shouldPersistOfflineQuery } from './persistence-policy.js';

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24,
        buster: QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistOfflineQuery,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
