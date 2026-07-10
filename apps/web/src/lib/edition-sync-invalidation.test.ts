import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  getInvalidationKeysForSseEvent,
  getInvalidationKeysForSyncBump,
  invalidateEditionSyncQueries,
} from './edition-sync-invalidation.js';
import { queryKeys } from './query-keys.js';

const editionId = '550e8400-e29b-41d4-a716-446655440000';

describe('edition-sync-invalidation', () => {
  it('maps match_result_submitted to matches', () => {
    const keys = getInvalidationKeysForSseEvent(editionId, 'match_result_submitted');
    expect(keys).toEqual([queryKeys.matchesForEdition(editionId)]);
  });

  it('maps player_withdrawn to participants and related queries', () => {
    const keys = getInvalidationKeysForSseEvent(editionId, 'player_withdrawn');
    expect(keys).toContainEqual(queryKeys.participants(editionId));
    expect(keys).toContainEqual(queryKeys.matchesForEdition(editionId));
    expect(keys).toContainEqual(queryKeys.standings(editionId));
  });

  it('sync bump invalidates broad edition queries', () => {
    const keys = getInvalidationKeysForSyncBump(editionId);
    expect(keys).toContainEqual(queryKeys.edition(editionId));
    expect(keys).toContainEqual(queryKeys.groups(editionId));
    expect(keys).toContainEqual(queryKeys.matchesForEdition(editionId));
  });

  it('invalida as consultas reais de partidas do organizador e do jogador', async () => {
    const queryClient = new QueryClient();
    const organizerKey = queryKeys.matches(editionId);
    const playerKey = queryKeys.matches(editionId, 'me');
    queryClient.setQueryData(organizerKey, []);
    queryClient.setQueryData(playerKey, []);

    await invalidateEditionSyncQueries(
      queryClient,
      editionId,
      getInvalidationKeysForSseEvent(editionId, 'match_result_submitted'),
    );

    expect(queryClient.getQueryState(organizerKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(playerKey)?.isInvalidated).toBe(true);
    queryClient.clear();
  });
});
