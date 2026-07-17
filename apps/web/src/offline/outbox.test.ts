import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type OutboxEntry } from '../db/clandestino-db.js';

vi.mock('../lib/session.js', () => ({
  getPlayerSession: vi.fn(),
}));

import { getPlayerSession } from '../lib/session.js';
import { enqueueSubmitMatchResult } from './outbox.js';

describe('enqueueSubmitMatchResult', () => {
  beforeEach(async () => {
    await db.outbox.clear();
    vi.mocked(getPlayerSession).mockResolvedValue({
      id: 'current',
      playerId: 'player-1',
      editionId: 'edition-1',
      playerName: 'Ana',
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
    await db.outbox.clear();
    vi.restoreAllMocks();
  });

  it('replaces an awaiting queued result for the same match', async () => {
    const first = await enqueueSubmitMatchResult('match-1', {
      outcome: 'PLAYED',
      setsWonByReporter: 2,
      setsWonByOpponent: 0,
    });

    const second = await enqueueSubmitMatchResult('match-1', {
      outcome: 'PLAYED',
      setsWonByReporter: 2,
      setsWonByOpponent: 1,
    });

    expect(second.id).toBe(first.id);
    expect(second.payload).toEqual({
      outcome: 'PLAYED',
      setsWonByReporter: 2,
      setsWonByOpponent: 1,
    });

    const all = await db.outbox.where('matchId').equals('match-1').toArray();
    expect(all).toHaveLength(1);
    expect(all[0]?.payload).toEqual(second.payload);
  });

  it('rejects replacement while an entry is syncing', async () => {
    const syncing: OutboxEntry = {
      id: 'outbox-syncing',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'match-2',
      playerId: 'player-1',
      editionId: 'edition-1',
      payload: {
        outcome: 'PLAYED',
        setsWonByReporter: 2,
        setsWonByOpponent: 0,
      },
      status: 'SINCRONIZANDO',
      createdAt: new Date().toISOString(),
      attemptCount: 1,
    };
    await db.outbox.put(syncing);

    await expect(
      enqueueSubmitMatchResult('match-2', {
        outcome: 'PLAYED',
        setsWonByReporter: 2,
        setsWonByOpponent: 1,
      }),
    ).rejects.toThrow(/aguardando sincronização/i);
  });
});
