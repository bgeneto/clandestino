import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { ClandestinoDatabase, SESSION_ROW_ID } from './clandestino-db.js';

const V5_STORES = {
  session: 'id',
  organizerSession: 'id',
  edition: 'id',
  groups: 'id, editionId',
  matches: 'id, editionId',
  standing: 'id, editionId, groupId',
  participants: 'id, editionId',
  outbox: 'id, status, createdAt, matchId',
  queryCache: 'key',
  editionWizardDraft: 'id, championshipId, editionId, syncStatus, updatedAt',
};

describe('ClandestinoDatabase v6 outbox identity backfill', () => {
  const opened: Array<{ delete: () => Promise<void> }> = [];

  afterEach(async () => {
    while (opened.length > 0) {
      const db = opened.pop();
      if (db) {
        await db.delete();
      }
    }
  });

  it('copia playerId/editionId da sessão para entradas outbox legadas', async () => {
    const name = `outbox-migrate-${Math.random().toString(36).slice(2)}`;
    const legacy = new Dexie(name);
    legacy.version(5).stores(V5_STORES);
    await legacy.open();
    opened.push(legacy);

    await legacy.table('session').put({
      id: SESSION_ROW_ID,
      playerId: 'player-legacy',
      editionId: 'edition-legacy',
      updatedAt: new Date().toISOString(),
    });
    await legacy.table('outbox').put({
      id: 'o-legacy',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'm-legacy',
      payload: { outcome: 'PLAYED', setsWonByReporter: 3, setsWonByOpponent: 1 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });
    await legacy.close();

    const migrated = new ClandestinoDatabase(name);
    await migrated.open();
    opened.push(migrated);

    const entry = await migrated.outbox.get('o-legacy');
    expect(entry?.playerId).toBe('player-legacy');
    expect(entry?.editionId).toBe('edition-legacy');
  });

  it('não sobrescreve identidade já presente na outbox', async () => {
    const name = `outbox-migrate-keep-${Math.random().toString(36).slice(2)}`;
    const legacy = new Dexie(name);
    legacy.version(5).stores(V5_STORES);
    await legacy.open();
    opened.push(legacy);

    await legacy.table('session').put({
      id: SESSION_ROW_ID,
      playerId: 'player-session',
      editionId: 'edition-session',
      updatedAt: new Date().toISOString(),
    });
    await legacy.table('outbox').put({
      id: 'o-keep',
      kind: 'SUBMIT_MATCH_RESULT',
      matchId: 'm-keep',
      playerId: 'player-original',
      editionId: 'edition-original',
      payload: { outcome: 'PLAYED', setsWonByReporter: 3, setsWonByOpponent: 0 },
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });
    await legacy.close();

    const migrated = new ClandestinoDatabase(name);
    await migrated.open();
    opened.push(migrated);

    const entry = await migrated.outbox.get('o-keep');
    expect(entry?.playerId).toBe('player-original');
    expect(entry?.editionId).toBe('edition-original');
  });
});
