import type { SubmitMatchResultBody } from '@clandestino/shared-contracts';
import { db, type OutboxEntry } from '../db/clandestino-db.js';

export async function listPendingOutboxEntries(): Promise<OutboxEntry[]> {
  return db.outbox.where('status').equals('AGUARDANDO_SINCRONIZACAO').sortBy('createdAt');
}

export async function countPendingOutboxEntries(): Promise<number> {
  return db.outbox.where('status').equals('AGUARDANDO_SINCRONIZACAO').count();
}

export async function enqueueSubmitMatchResult(
  matchId: string,
  payload: SubmitMatchResultBody,
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    kind: 'SUBMIT_MATCH_RESULT',
    matchId,
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
