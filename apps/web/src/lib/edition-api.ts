import type { Edition, EditionGroupsResponse } from '@clandestino/shared-contracts';
import { apiRequest } from './api-client.js';
import { cacheEdition, cacheGroups, getCachedEdition, getCachedGroups } from './edition-cache.js';

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

export {
  cacheEdition,
  cacheGroups,
  cacheMatches,
  cacheStandings,
  getCachedEdition,
  getCachedGroups,
  getCachedMatches,
  getCachedStandings,
} from './edition-cache.js';
