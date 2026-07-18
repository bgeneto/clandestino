import type {
  ContestMatchBody,
  Edition,
  EditionGroupsResponse,
  EditionMatchesResponse,
  EditionParticipantsResponse,
  EditionStandingsResponse,
  MatchResultResponse,
  PlayerMatchesResponse,
} from '@clandestino/shared-contracts';
import { apiRequest } from './api-client.js';
import { shouldUseOfflineCache } from './api-errors.js';
import {
  cacheEdition,
  cacheGroups,
  cacheMatches,
  cacheParticipants,
  cacheStandings,
  getCachedEdition,
  getCachedGroups,
  getCachedMatches,
  getCachedMatchesForPlayer,
  getCachedParticipants,
  getCachedStandings,
  isEditionMatchesCacheComplete,
  upsertCachedMatches,
} from './edition-cache.js';
import { getPlayerSession } from './session.js';

async function withOfflineFallback<T>(
  fetcher: () => Promise<T>,
  readCache: () => Promise<T | undefined>,
  writer: (value: T) => Promise<void>,
): Promise<T> {
  try {
    const value = await fetcher();
    await writer(value);
    return value;
  } catch (error) {
    if (!shouldUseOfflineCache(error)) {
      throw error;
    }

    const cached = await readCache();
    if (cached !== undefined) {
      return cached;
    }

    throw error;
  }
}

export async function fetchEdition(editionId: string): Promise<Edition> {
  return withOfflineFallback(
    () => apiRequest<Edition>(`/editions/${editionId}`),
    () => getCachedEdition(editionId),
    (edition) => cacheEdition(edition),
  );
}

export async function fetchEditionGroups(editionId: string): Promise<EditionGroupsResponse> {
  return withOfflineFallback(
    () => apiRequest<EditionGroupsResponse>(`/editions/${editionId}/groups`),
    () => getCachedGroups(editionId),
    (groups) => cacheGroups(editionId, groups),
  );
}

export async function fetchEditionStandings(editionId: string): Promise<EditionStandingsResponse> {
  return withOfflineFallback(
    () => apiRequest<EditionStandingsResponse>(`/editions/${editionId}/standings`),
    () => getCachedStandings(editionId),
    (standings) => cacheStandings(editionId, standings),
  );
}

export async function fetchEditionMatches(editionId: string): Promise<EditionMatchesResponse> {
  return withOfflineFallback(
    () => apiRequest<EditionMatchesResponse>(`/editions/${editionId}/matches`),
    async () => {
      if (!(await isEditionMatchesCacheComplete(editionId))) {
        return undefined;
      }
      const matches = await getCachedMatches(editionId);
      return matches.length > 0 ? { matches } : undefined;
    },
    (response) => cacheMatches(editionId, response.matches),
  );
}

export async function fetchPlayerMatches(editionId: string): Promise<PlayerMatchesResponse> {
  return withOfflineFallback(
    () =>
      apiRequest<PlayerMatchesResponse>(`/editions/${editionId}/me/matches`, {
        playerAuth: true,
      }),
    async () => {
      const session = await getPlayerSession();
      if (!session || session.editionId !== editionId) {
        return undefined;
      }
      const sessionMatches = await getCachedMatchesForPlayer(editionId, session.playerId);
      return sessionMatches.length > 0 ? { matches: sessionMatches } : undefined;
    },
    (response) => upsertCachedMatches(editionId, response.matches),
  );
}

export async function fetchEditionParticipants(
  editionId: string,
): Promise<EditionParticipantsResponse> {
  return withOfflineFallback(
    () => apiRequest<EditionParticipantsResponse>(`/editions/${editionId}/participants`),
    () => getCachedParticipants(editionId),
    (response) => cacheParticipants(editionId, response),
  );
}

export async function confirmMatch(matchId: string): Promise<MatchResultResponse> {
  return apiRequest<MatchResultResponse>(`/matches/${matchId}/confirm`, {
    method: 'POST',
    playerAuth: true,
  });
}

export async function contestMatch(
  matchId: string,
  body: ContestMatchBody,
): Promise<MatchResultResponse> {
  return apiRequest<MatchResultResponse>(`/matches/${matchId}/contest`, {
    method: 'POST',
    body,
    playerAuth: true,
  });
}

export {
  cacheEdition,
  cacheGroups,
  cacheMatches,
  cacheParticipants,
  cacheStandings,
  getCachedEdition,
  getCachedGroups,
  getCachedMatches,
  getCachedParticipants,
  getCachedStandings,
} from './edition-cache.js';
