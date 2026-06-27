import type { MatchResultResponse } from '@clandestino/shared-contracts';
import { buildApiUrl } from '../lib/api-config.js';
import {
  db,
  SESSION_ROW_ID,
  type ClandestinoDatabase,
  type OutboxEntry,
} from '../db/clandestino-db.js';

export type ProcessOutboxResult = {
  processed: number;
  failed: number;
};

async function readSessionHeaders(database: ClandestinoDatabase): Promise<Record<string, string>> {
  const session = await database.session.get(SESSION_ROW_ID);
  if (!session) {
    return {};
  }

  return {
    'X-Player-Id': session.playerId,
    'X-Edition-Id': session.editionId,
  };
}

async function syncOutboxEntry(
  entry: OutboxEntry,
  sessionHeaders: Record<string, string>,
): Promise<void> {
  if (entry.kind !== 'SUBMIT_MATCH_RESULT') {
    throw new Error(`Tipo de fila não suportado: ${entry.kind}`);
  }

  const response = await fetch(buildApiUrl(`/matches/${entry.matchId}/result`), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...sessionHeaders,
    },
    body: JSON.stringify(entry.payload),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // resposta não-JSON
    }
    throw new Error(message);
  }

  (await response.json()) as MatchResultResponse;
}

async function notifyClients(result: ProcessOutboxResult): Promise<void> {
  const swScope = globalThis.ServiceWorkerGlobalScope;
  if (typeof self === 'undefined' || !swScope || !(self instanceof swScope)) {
    return;
  }

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({
      type: 'OUTBOX_SYNCED',
      ...result,
    });
  }
}

export async function processOutbox(
  database: ClandestinoDatabase = db,
): Promise<ProcessOutboxResult> {
  const sessionHeaders = await readSessionHeaders(database);
  if (Object.keys(sessionHeaders).length === 0) {
    return { processed: 0, failed: 0 };
  }

  const pending = await database.outbox
    .where('status')
    .equals('AGUARDANDO_SINCRONIZACAO')
    .sortBy('createdAt');

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    await database.outbox.update(entry.id, { status: 'SINCRONIZANDO' });

    try {
      await syncOutboxEntry(entry, sessionHeaders);
      await database.outbox.delete(entry.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      await database.outbox.update(entry.id, {
        status: 'AGUARDANDO_SINCRONIZACAO',
        lastError: error instanceof Error ? error.message : String(error),
        attemptCount: entry.attemptCount + 1,
      });
    }
  }

  const result = { processed, failed };
  await notifyClients(result);

  if (typeof window !== 'undefined' && processed > 0) {
    window.dispatchEvent(
      new CustomEvent('clandestino:outbox-synced', {
        detail: result,
      }),
    );
  }

  return result;
}
