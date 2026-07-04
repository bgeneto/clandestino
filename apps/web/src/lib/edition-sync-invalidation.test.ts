import { describe, expect, it } from 'vitest';
import {
  getInvalidationKeysForSseEvent,
  getInvalidationKeysForSyncBump,
} from './edition-sync-invalidation.js';
import { queryKeys } from './query-keys.js';

const editionId = '550e8400-e29b-41d4-a716-446655440000';

describe('edition-sync-invalidation', () => {
  it('maps match_result_submitted to matches', () => {
    const keys = getInvalidationKeysForSseEvent(editionId, 'match_result_submitted');
    expect(keys).toEqual([[queryKeys.matches(editionId)]]);
  });

  it('maps player_withdrawn to participants and related queries', () => {
    const keys = getInvalidationKeysForSseEvent(editionId, 'player_withdrawn');
    expect(keys).toContainEqual([queryKeys.participants(editionId)]);
    expect(keys).toContainEqual([queryKeys.matches(editionId)]);
    expect(keys).toContainEqual([queryKeys.standings(editionId)]);
  });

  it('sync bump invalidates broad edition queries', () => {
    const keys = getInvalidationKeysForSyncBump(editionId);
    expect(keys).toContainEqual([queryKeys.edition(editionId)]);
    expect(keys).toContainEqual([queryKeys.groups(editionId)]);
    expect(keys).toContainEqual([queryKeys.matches(editionId)]);
  });
});
