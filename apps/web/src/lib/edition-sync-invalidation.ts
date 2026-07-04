import type { SseEventType } from '@clandestino/shared-contracts';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

export function getInvalidationKeysForSseEvent(
  editionId: string,
  event: SseEventType,
): readonly (readonly unknown[])[] {
  switch (event) {
    case 'match_result_submitted':
      return [[queryKeys.matches(editionId)]];
    case 'match_confirmed':
      return [
        [queryKeys.matches(editionId)],
        [queryKeys.standings(editionId)],
        [queryKeys.edition(editionId)],
        [queryKeys.organizerActiveEditions()],
      ];
    case 'phase_published':
      return [
        [queryKeys.groups(editionId)],
        [queryKeys.matches(editionId)],
        [queryKeys.standings(editionId)],
        [queryKeys.edition(editionId)],
        [queryKeys.organizerActiveEditions()],
      ];
    case 'match_contested':
      return [[queryKeys.contestedMatches(editionId)], [queryKeys.matches(editionId)]];
    case 'player_withdrawn':
      return [
        [queryKeys.participants(editionId)],
        [queryKeys.matches(editionId)],
        [queryKeys.standings(editionId)],
        [queryKeys.groups(editionId)],
        [queryKeys.edition(editionId)],
        [queryKeys.contestedMatches(editionId)],
        [queryKeys.organizerActiveEditions()],
      ];
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Invalidação ampla quando o polling detecta revisão sem detalhe do evento. */
export function getInvalidationKeysForSyncBump(editionId: string): readonly (readonly unknown[])[] {
  return [
    [queryKeys.edition(editionId)],
    [queryKeys.participants(editionId)],
    [queryKeys.registrations(editionId)],
    [queryKeys.groups(editionId)],
    [queryKeys.standings(editionId)],
    [queryKeys.matches(editionId)],
    [queryKeys.contestedMatches(editionId)],
    [queryKeys.drawSnapshots(editionId)],
    [queryKeys.finalPlacements(editionId)],
    [queryKeys.organizerActiveEditions()],
  ];
}

export async function invalidateEditionSyncQueries(
  queryClient: QueryClient,
  editionId: string,
  keys: readonly (readonly unknown[])[],
): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

const REVISION_STORAGE_PREFIX = 'clandestino:sync-revision:';

export function readStoredSyncRevision(editionId: string): number {
  try {
    const raw = sessionStorage.getItem(`${REVISION_STORAGE_PREFIX}${editionId}`);
    if (!raw) {
      return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeStoredSyncRevision(editionId: string, revision: number): void {
  try {
    sessionStorage.setItem(`${REVISION_STORAGE_PREFIX}${editionId}`, String(revision));
  } catch {
    // sessionStorage indisponível
  }
}
