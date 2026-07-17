import { db } from '../db/clandestino-db.js';
import { getOnlineStatus } from '../lib/online-status.js';
import { syncEditionWizardDraft } from './sync-edition-wizard.js';

const RETRYABLE_STATUSES = ['PRONTO_PARA_SINCRONIZAR', 'ERRO', 'SINCRONIZANDO'] as const;

/** Recupera drafts presos em SINCRONIZANDO (crash mid-flight) e requeueia ERRO. */
export async function syncPendingEditionWizardDrafts(): Promise<void> {
  if (!getOnlineStatus()) {
    return;
  }

  const candidates = (
    await Promise.all(
      RETRYABLE_STATUSES.map((status) =>
        db.editionWizardDraft.where('syncStatus').equals(status).toArray(),
      ),
    )
  ).flat();

  // Evita processar o mesmo draft duas vezes se índices/status mudarem mid-loop.
  const seen = new Set<string>();

  for (const draft of candidates) {
    if (seen.has(draft.id)) {
      continue;
    }
    seen.add(draft.id);
    await syncEditionWizardDraft(draft);
  }
}
