import type {
  ChampionshipEditionsResponse,
  Edition,
  EditionSummary,
} from '@clandestino/shared-contracts';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

function compareEditionSummaries(left: EditionSummary, right: EditionSummary): number {
  return right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt);
}

export function mergeCreatedEditions(
  current: ChampionshipEditionsResponse | undefined,
  championshipId: string,
  createdEditions: Edition[],
): ChampionshipEditionsResponse {
  const byId = new Map<string, EditionSummary>();

  for (const edition of current?.editions ?? []) {
    byId.set(edition.id, edition);
  }
  for (const edition of createdEditions) {
    byId.set(edition.id, edition);
  }

  return {
    championshipId,
    editions: [...byId.values()].sort(compareEditionSummaries),
  };
}

export function cacheCreatedEditions(
  queryClient: QueryClient,
  championshipId: string,
  createdEditions: Edition[],
): void {
  queryClient.setQueryData<ChampionshipEditionsResponse>(
    queryKeys.championshipEditions(championshipId),
    (current) => mergeCreatedEditions(current, championshipId, createdEditions),
  );
}
