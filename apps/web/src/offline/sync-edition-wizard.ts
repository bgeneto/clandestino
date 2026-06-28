import type { Edition, ExecuteDrawBody } from '@clandestino/shared-contracts';
import { ApiError } from '../lib/api-client.js';
import {
  createEdition,
  createPlayer,
  executeDraw,
  generateMatches,
  registerPlayer,
} from '../lib/organizer-api.js';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { deleteEditionWizardDraft, saveEditionWizardDraft } from './edition-wizard-draft.js';

export type WizardSyncResult =
  | { status: 'synced'; editionId: string }
  | { status: 'conflict'; message: string }
  | { status: 'error'; message: string };

export async function syncEditionWizardDraft(draft: EditionWizardDraft): Promise<WizardSyncResult> {
  if (!navigator.onLine) {
    return { status: 'error', message: 'Sem conexão com a internet.' };
  }

  if (!draft.groupCount || !draft.groupSizes || !draft.seedPlayerIds || !draft.matchBestOf) {
    return { status: 'error', message: 'Complete todos os passos antes de sincronizar.' };
  }

  const syncingDraft = await saveEditionWizardDraft({
    ...draft,
    syncStatus: 'SINCRONIZANDO',
    syncError: undefined,
  });

  try {
    let editionId = syncingDraft.editionId;
    const idRemap = new Map<string, string>();

    for (const player of syncingDraft.checkedInPlayers.filter((entry) => entry.isNew)) {
      try {
        const created = await createPlayer({ name: player.playerName });
        idRemap.set(player.playerId, created.id);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) {
          throw error;
        }
      }
    }

    if (idRemap.size > 0) {
      syncingDraft.checkedInPlayers = syncingDraft.checkedInPlayers.map((entry) => {
        const remappedId = idRemap.get(entry.playerId);
        if (!remappedId) {
          return entry;
        }

        return {
          ...entry,
          playerId: remappedId,
          isNew: false,
        };
      });

      if (syncingDraft.seedPlayerIds) {
        syncingDraft.seedPlayerIds = syncingDraft.seedPlayerIds.map(
          (playerId) => idRemap.get(playerId) ?? playerId,
        );
      }
    }

    if (!editionId) {
      const edition = await createEdition({
        championshipId: syncingDraft.championshipId,
        date: syncingDraft.date,
        autoConfirmMinutes: syncingDraft.autoConfirmMinutes,
      });
      editionId = edition.id;
    }

    for (const player of syncingDraft.checkedInPlayers) {
      try {
        await registerPlayer(editionId, { playerId: player.playerId });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) {
          throw error;
        }
      }
    }

    const drawBody: ExecuteDrawBody = {
      randomSeed: syncingDraft.drawRandomSeed,
      groupCount: syncingDraft.groupCount,
      groupSizes: syncingDraft.groupSizes,
      seedPlayerIds: syncingDraft.seedPlayerIds,
      matchBestOf: syncingDraft.matchBestOf,
    };

    try {
      await executeDraw(editionId, drawBody);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return {
          status: 'conflict',
          message: 'Esta edição já possui sorteio publicado no servidor.',
        };
      }

      throw error;
    }

    await generateMatches(editionId);

    await saveEditionWizardDraft({
      ...syncingDraft,
      editionId,
      syncStatus: 'SINCRONIZADO',
      syncError: undefined,
    });

    await deleteEditionWizardDraft(syncingDraft.id);

    return { status: 'synced', editionId };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Falha ao sincronizar o rascunho.';

    await saveEditionWizardDraft({
      ...syncingDraft,
      syncStatus: 'ERRO',
      syncError: message,
    });

    return { status: 'error', message };
  }
}

export function draftNeedsServerEdition(draft: EditionWizardDraft): boolean {
  return draft.editionId === undefined;
}

export function canPublishDraft(draft: EditionWizardDraft): boolean {
  return (
    draft.checkedInPlayers.length >= 3 &&
    draft.groupCount !== undefined &&
    draft.groupSizes !== undefined &&
    draft.seedPlayerIds !== undefined &&
    draft.matchBestOf !== undefined &&
    draft.drawPreview !== undefined &&
    draft.drawPreview.length > 0
  );
}

export function resolveEditionNameAfterSync(draft: EditionWizardDraft, edition?: Edition): string {
  return edition?.name ?? draft.predictedEditionName;
}
