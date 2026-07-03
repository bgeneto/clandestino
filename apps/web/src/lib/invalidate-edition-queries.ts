import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

export async function invalidateEditionQueries(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.edition(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.groups(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.participants(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.registrations(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matches(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.drawSnapshots(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.editionQr(editionId) }),
  ]);
}

export async function invalidateEditionAfterPublish(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await invalidateEditionQueries(queryClient, editionId);
  await queryClient.refetchQueries({ queryKey: queryKeys.edition(editionId) });
}
