import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { ClandestinoDatabase } from '../db/clandestino-db.js';
import { processOutbox, resetProcessOutboxLockForTests } from './process-outbox.js';

describe('processOutbox', () => {
  let database: ClandestinoDatabase;

  beforeEach(() => {
    resetProcessOutboxLockForTests();
    database = new ClandestinoDatabase(`outbox-test-${Math.random().toString(36).slice(2)}`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ match: { id: 'm1' } }),
      }),
    );
  });

  afterEach(async () => {
    resetProcessOutboxLockForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await database.delete();
  });

  it('recupera entradas SINCRONIZANDO e sincroniza com a identidade da entrada', async () => {
    await database.outbox.put({
      id: 'o1',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'm1',
      playerId: 'player-a',
      editionId: 'edition-1',
      payload: { outcome: 'PLAYED', setsWonByReporter: 3, setsWonByOpponent: 1 },
      status: 'SINCRONIZANDO',
      createdAt: new Date().toISOString(),
      attemptCount: 1,
    });

    const result = await processOutbox(database);

    expect(result.processed).toBe(1);
    expect(await database.outbox.count()).toBe(0);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/matches/m1/result'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Player-Id': 'player-a',
          'X-Edition-Id': 'edition-1',
        }),
      }),
    );
  });

  it('marca 409 com corpo ApiError como FALHA permanente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Esta partida não aceita novos resultados.' }),
      }),
    );

    await database.outbox.put({
      id: 'o-conflict',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'm-conflict',
      playerId: 'player-a',
      editionId: 'edition-1',
      payload: { outcome: 'PLAYED', setsWonByReporter: 3, setsWonByOpponent: 1 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });

    const result = await processOutbox(database);
    const entry = await database.outbox.get('o-conflict');

    expect(result.failed).toBe(1);
    expect(entry?.status).toBe('FALHA');
    expect(entry?.lastError).toBe('Esta partida não aceita novos resultados.');
  });

  it('reatenta erros transitórios (5xx) sem marcar FALHA', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Serviço indisponível' }),
      }),
    );

    await database.outbox.put({
      id: 'o-retry',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'm-retry',
      playerId: 'player-a',
      editionId: 'edition-1',
      payload: { outcome: 'PLAYED', setsWonByReporter: 3, setsWonByOpponent: 0 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });

    const result = await processOutbox(database);
    const entry = await database.outbox.get('o-retry');

    expect(result.failed).toBe(1);
    expect(entry?.status).toBe('AGUARDANDO_SINCRONIZACAO');
    expect(entry?.lastError).toBe('Serviço indisponível');
  });

  it('deduplica processamentos concorrentes', async () => {
    let resolveFetchStarted: (() => void) | undefined;
    let resolveFetchResult:
      ((value: { ok: boolean; json: () => Promise<object> }) => void) | undefined;

    const fetchStarted = new Promise<void>((resolve) => {
      resolveFetchStarted = resolve;
    });
    const fetchResult = new Promise<{ ok: boolean; json: () => Promise<object> }>((resolve) => {
      resolveFetchResult = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        resolveFetchStarted?.();
        return fetchResult;
      }),
    );

    await database.outbox.put({
      id: 'o2',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'm2',
      playerId: 'player-a',
      editionId: 'edition-1',
      payload: { outcome: 'PLAYED', setsWonByReporter: 3, setsWonByOpponent: 0 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });

    const first = processOutbox(database);
    await fetchStarted;
    const second = processOutbox(database);

    resolveFetchResult?.({
      ok: true,
      json: async () => ({ match: { id: 'm2' } }),
    });

    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
