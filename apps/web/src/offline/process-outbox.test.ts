import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClandestinoDatabase, SESSION_ROW_ID, type OutboxEntry } from '../db/clandestino-db.js';
import { processOutbox } from './process-outbox.js';

describe('processOutbox', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('envia itens pendentes e remove da fila após confirmação da API', async () => {
    const database = new ClandestinoDatabase(`test-${crypto.randomUUID()}`);
    await database.open();

    await database.session.put({
      id: SESSION_ROW_ID,
      playerId: '11111111-1111-4111-8111-111111111111',
      editionId: '22222222-2222-4222-8222-222222222222',
      updatedAt: new Date().toISOString(),
    });

    const entry: OutboxEntry = {
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: '44444444-4444-4444-8444-444444444444',
      payload: { setsWonByReporter: 2, setsWonByOpponent: 0 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    };

    await database.outbox.put(entry);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ match: { id: entry.matchId } }),
      })),
    );

    const result = await processOutbox(database);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(await database.outbox.count()).toBe(0);

    await database.delete();
  });

  it('mantém item na fila quando a API rejeita', async () => {
    const database = new ClandestinoDatabase(`test-${crypto.randomUUID()}`);
    await database.open();

    await database.session.put({
      id: SESSION_ROW_ID,
      playerId: '11111111-1111-4111-8111-111111111111',
      editionId: '22222222-2222-4222-8222-222222222222',
      updatedAt: new Date().toISOString(),
    });

    await database.outbox.put({
      id: '55555555-5555-4555-8555-555555555555',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: '66666666-6666-4666-8666-666666666666',
      payload: { setsWonByReporter: 2, setsWonByOpponent: 1 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Partida indisponível' }),
      })),
    );

    const result = await processOutbox(database);

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);

    const remaining = await database.outbox.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.status).toBe('AGUARDANDO_SINCRONIZACAO');
    expect(remaining[0]?.attemptCount).toBe(1);

    await database.delete();
  });
});
