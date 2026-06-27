import { useQuery } from '@tanstack/react-query';
import { fetchEdition } from '../lib/edition-api.js';
import { queryKeys } from '../lib/query-keys.js';

export function useEdition(editionId: string | undefined) {
  return useQuery({
    queryKey: editionId ? queryKeys.edition(editionId) : ['edition', 'unknown'],
    queryFn: () => fetchEdition(editionId!),
    enabled: editionId !== undefined,
  });
}
