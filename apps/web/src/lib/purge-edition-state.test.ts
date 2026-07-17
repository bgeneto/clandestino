import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { QueryClient } from '@tanstack/react-query';
import { ClandestinoDatabase, SESSION_ROW_ID, type OutboxEntry } from '../db/clandestino-db.js';
import { purgeEditionLocalState } from './purge-edition-state.js';

vi.mock('@tanstack/react-query-persist-client', () => ({
  persistQueryClientSave: vi.fn(async () => undefined),
}));

const editionId = '11111111-1111-4111-8111-111111111111';
const otherEditionId = '99999999-9999-4999-8999-999999999999';
const matchId = '44444444-4444-4444-8444-444444444444';
const playerId = '33333333-3333-4333-8333-333333333333';

describe('purgeEditionLocalState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remove sessão, caches, outbox e drafts da edição', async () => {
    const database = new ClandestinoDatabase(`test-${crypto.randomUUID()}`);
    await database.open();

    const queryClient = new QueryClient();

    await database.session.put({
      id: SESSION_ROW_ID,
      playerId,
      editionId,
      playerName: 'Alice',
      updatedAt: new Date().toISOString(),
    });

    await database.edition.put({
      id: editionId,
      edition: {
        id: editionId,
        championshipId: '22222222-2222-4222-8222-222222222222',
        name: 'Test',
        date: '2026-06-28',
        status: 'EM_ANDAMENTO',
        autoConfirmMinutes: 60,
        syncRevision: 0,
        rules: DEFAULT_EDITION_RULES,
        createdAt: '2026-06-28T00:00:00.000Z',
      },
      cachedAt: new Date().toISOString(),
    });

    await database.groups.put({
      id: editionId,
      editionId,
      groups: { groups: [] },
      cachedAt: new Date().toISOString(),
    });

    await database.participants.put({
      id: editionId,
      editionId,
      participants: [],
      cachedAt: new Date().toISOString(),
    });

    await database.standing.put({
      id: `${editionId}:group-a`,
      editionId,
      groupId: 'group-a',
      standings: { groups: [] },
      cachedAt: new Date().toISOString(),
    });

    await database.matches.put({
      id: matchId,
      editionId,
      match: { id: matchId } as never,
      cachedAt: new Date().toISOString(),
    });

    const outboxEntry: OutboxEntry = {
      id: '55555555-5555-4555-8555-555555555555',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId,
      playerId: '11111111-1111-4111-8111-111111111111',
      editionId,
      payload: { setsWonByReporter: 2, setsWonByOpponent: 0 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    };
    await database.outbox.put(outboxEntry);

    await database.editionWizardDraft.put({
      id: '66666666-6666-4666-8666-666666666666',
      championshipId: '22222222-2222-4222-8222-222222222222',
      editionId,
      predictedEditionName: 'Draft',
      date: '2026-06-28',
      autoConfirmMinutes: 60,
      currentStep: 1,
      checkedInPlayers: [],
      syncStatus: 'RASCUNHO_LOCAL',
      updatedAt: new Date().toISOString(),
    });

    queryClient.setQueryData(['edition', editionId], { id: editionId });
    queryClient.setQueryData(['edition', otherEditionId], { id: otherEditionId });

    await purgeEditionLocalState(editionId, queryClient, database);

    expect(await database.session.get(SESSION_ROW_ID)).toBeUndefined();
    expect(await database.edition.get(editionId)).toBeUndefined();
    expect(await database.groups.get(editionId)).toBeUndefined();
    expect(await database.participants.get(editionId)).toBeUndefined();
    expect(await database.standing.where('editionId').equals(editionId).count()).toBe(0);
    expect(await database.matches.where('editionId').equals(editionId).count()).toBe(0);
    expect(await database.outbox.count()).toBe(0);
    expect(await database.editionWizardDraft.where('editionId').equals(editionId).count()).toBe(0);
    expect(queryClient.getQueryData(['edition', editionId])).toBeUndefined();
    expect(queryClient.getQueryData(['edition', otherEditionId])).toBeDefined();

    await database.delete();
  });

  it('é idempotente em chamadas repetidas', async () => {
    const database = new ClandestinoDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    const queryClient = new QueryClient();

    await purgeEditionLocalState(editionId, queryClient, database);
    await expect(purgeEditionLocalState(editionId, queryClient, database)).resolves.toBeUndefined();

    await database.delete();
  });
});
