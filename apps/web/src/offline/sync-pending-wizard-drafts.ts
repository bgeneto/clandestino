import { db } from '../db/clandestino-db.js';
import { syncEditionWizardDraft } from './sync-edition-wizard.js';

export async function syncPendingEditionWizardDrafts(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }

  const pendingDrafts = await db.editionWizardDraft
    .where('syncStatus')
    .equals('PRONTO_PARA_SINCRONIZAR')
    .toArray();

  for (const draft of pendingDrafts) {
    await syncEditionWizardDraft(draft);
  }
}
