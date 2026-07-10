import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

export async function invalidateChampionshipQueries(
  queryClient: QueryClient,
  championshipId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.championships() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.championship(championshipId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.championshipEditions(championshipId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.championshipRanking(championshipId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.championshipRoster(championshipId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.organizerActiveEditions() }),
  ]);
}

export async function invalidateEditionQueries(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.edition(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.groups(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.participants(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.registrations(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matchesForEdition(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.drawSnapshots(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.editionQr(editionId) }),
  ]);
}

export async function invalidateEditionAfterMatchOfficialized(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await Promise.all([
    invalidateEditionQueries(queryClient, editionId),
    queryClient.invalidateQueries({ queryKey: queryKeys.standings(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.contestedMatches(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.organizerActiveEditions() }),
  ]);
}

export async function invalidateEditionAfterPublish(
  queryClient: QueryClient,
  editionId: string,
  championshipId: string,
): Promise<void> {
  await Promise.all([
    invalidateEditionQueries(queryClient, editionId),
    invalidateChampionshipQueries(queryClient, championshipId),
  ]);
  await queryClient.refetchQueries({ queryKey: queryKeys.edition(editionId) });
}
