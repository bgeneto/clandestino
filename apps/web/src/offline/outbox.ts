import type { SubmitMatchResultBody } from '@clandestino/shared-contracts';
import { db, type OutboxEntry } from '../db/clandestino-db.js';
import { createClientId } from '../lib/create-client-id.js';
import { getPlayerSession } from '../lib/session.js';

export async function listPendingOutboxEntries(): Promise<OutboxEntry[]> {
  return db.outbox.where('status').equals('AGUARDANDO_SINCRONIZACAO').sortBy('createdAt');
}

export async function countPendingOutboxEntries(): Promise<number> {
  const awaiting = await db.outbox.where('status').equals('AGUARDANDO_SINCRONIZACAO').count();
  const syncing = await db.outbox.where('status').equals('SINCRONIZANDO').count();
  return awaiting + syncing;
}

export async function enqueueSubmitMatchResult(
  matchId: string,
  payload: SubmitMatchResultBody,
): Promise<OutboxEntry> {
  const session = await getPlayerSession();
  if (!session) {
    throw new Error('Sessão de jogador ausente para enfileirar resultado.');
  }

  const existingForMatch = await db.outbox.where('matchId').equals(matchId).toArray();
  const pendingForPlayer = existingForMatch.filter(
    (entry) => entry.kind === 'SUBMIT_MATCH_RESULT' && entry.playerId === session.playerId,
  );
  const syncing = pendingForPlayer.find((entry) => entry.status === 'SINCRONIZANDO');
  if (syncing) {
    throw new Error('Já existe um resultado deste jogo aguardando sincronização.');
  }

  const replaceable = pendingForPlayer.find((entry) => entry.status === 'AGUARDANDO_SINCRONIZACAO');
  if (replaceable) {
    const updated: OutboxEntry = {
      id: replaceable.id,
      kind: 'SUBMIT_MATCH_RESULT',
      matchId,
      playerId: session.playerId,
      editionId: session.editionId,
      payload,
      status: 'AGUARDANDO_SINCRONIZACAO',
      createdAt: replaceable.createdAt,
      attemptCount: 0,
    };
    await db.outbox.put(updated);
    await requestBackgroundSync();
    return updated;
  }

  const entry: OutboxEntry = {
    id: createClientId('outbox'),
    kind: 'SUBMIT_MATCH_RESULT',
    matchId,
    playerId: session.playerId,
    editionId: session.editionId,
    payload,
    status: 'AGUARDANDO_SINCRONIZACAO',
    createdAt: new Date().toISOString(),
    attemptCount: 0,
  };

  await db.outbox.put(entry);
  await requestBackgroundSync();
  return entry;
}

export async function requestBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register(tag: string): Promise<void> };
        }
      ).sync.register('outbox-sync');
    }
  } catch {
    // Background Sync indisponível — o listener online do cliente cobre o fluxo.
  }
}

export type OutboxSyncResult = {
  processed: number;
  failed: number;
};

export const OUTBOX_SYNC_MESSAGE = 'clandestino:outbox-synced';

export function notifyOutboxSynced(processed: number): void {
  window.dispatchEvent(
    new CustomEvent(OUTBOX_SYNC_MESSAGE, {
      detail: { processed },
    }),
  );
}
