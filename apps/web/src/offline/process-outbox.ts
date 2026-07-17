import type { MatchResultResponse } from '@clandestino/shared-contracts';
import { buildApiUrl } from '../lib/api-config.js';
import { db, type ClandestinoDatabase, type OutboxEntry } from '../db/clandestino-db.js';

export type ProcessOutboxResult = {
  processed: number;
  failed: number;
};

let processInFlight: Promise<ProcessOutboxResult> | null = null;

function headersForEntry(entry: OutboxEntry): Record<string, string> | null {
  if (!entry.playerId || !entry.editionId) {
    return null;
  }

  return {
    'X-Player-Id': entry.playerId,
    'X-Edition-Id': entry.editionId,
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

/** Recupera entradas presas em SINCRONIZANDO (crash/SW kill mid-flight). */
async function recoverStuckEntries(database: ClandestinoDatabase): Promise<void> {
  const stuck = await database.outbox.where('status').equals('SINCRONIZANDO').toArray();
  for (const entry of stuck) {
    await database.outbox.update(entry.id, { status: 'AGUARDANDO_SINCRONIZACAO' });
  }
}

async function processOutboxOnce(database: ClandestinoDatabase): Promise<ProcessOutboxResult> {
  await recoverStuckEntries(database);

  const pending = await database.outbox
    .where('status')
    .equals('AGUARDANDO_SINCRONIZACAO')
    .sortBy('createdAt');

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    const sessionHeaders = headersForEntry(entry);
    if (!sessionHeaders) {
      failed += 1;
      await database.outbox.update(entry.id, {
        status: 'FALHA',
        lastError: 'Entrada sem identidade de jogador/edição.',
        attemptCount: entry.attemptCount + 1,
      });
      continue;
    }

    await database.outbox.update(entry.id, { status: 'SINCRONIZANDO' });

    try {
      await syncOutboxEntry(entry, sessionHeaders);
      await database.outbox.delete(entry.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      const permanentClientError =
        message.includes('HTTP 403') ||
        message.includes('HTTP 404') ||
        message.includes('HTTP 409') ||
        /não inscrito|não encontrada|já|conflito/i.test(message);

      await database.outbox.update(entry.id, {
        status: permanentClientError ? 'FALHA' : 'AGUARDANDO_SINCRONIZACAO',
        lastError: message,
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

export async function processOutbox(
  database: ClandestinoDatabase = db,
): Promise<ProcessOutboxResult> {
  if (processInFlight) {
    return processInFlight;
  }

  processInFlight = processOutboxOnce(database).finally(() => {
    processInFlight = null;
  });

  return processInFlight;
}

/** Só para testes. */
export function resetProcessOutboxLockForTests(): void {
  processInFlight = null;
}
