import type { Edition, ExecuteDrawBody } from '@clandestino/shared-contracts';
import { estimateRoundRobinMatches } from '@clandestino/tournament-engine';
import { ApiError } from '../lib/api-client.js';
import { isDrawPreviewStale, remapDraftPlayerIds } from '../lib/draw-input-fingerprint.js';
import { fetchEdition, fetchEditionGroups, fetchEditionMatches } from '../lib/edition-api.js';
import {
  createEdition,
  createPlayer,
  executeDraw,
  fetchEditionRegistrations,
  generateMatches,
  registerPlayer,
} from '../lib/organizer-api.js';
import { getOnlineStatus } from '../lib/online-status.js';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { deleteEditionWizardDraft, saveEditionWizardDraft } from './edition-wizard-draft.js';
import { buildApprovedGroupsFromDraft } from './sync-wizard-draw-plan.js';

export type WizardSyncResult =
  | { status: 'synced'; editionId: string }
  | { status: 'conflict'; message: string }
  | { status: 'error'; message: string };

async function saveConflict(
  workingDraft: EditionWizardDraft,
  editionId: string,
  message: string,
): Promise<WizardSyncResult> {
  await saveEditionWizardDraft({
    ...workingDraft,
    editionId,
    syncStatus: 'ERRO',
    syncError: message,
  });
  return { status: 'conflict', message };
}

function samePlayerSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

async function playerIsRegistered(editionId: string, playerId: string): Promise<boolean> {
  const response = await fetchEditionRegistrations(editionId);
  return response.registrations.some((entry) => entry.playerId === playerId);
}

async function registrationsMatchDraft(
  editionId: string,
  draft: EditionWizardDraft,
): Promise<boolean> {
  const response = await fetchEditionRegistrations(editionId);
  const serverIds = new Set(response.registrations.map((entry) => entry.playerId));
  return draft.checkedInPlayers.every((player) => serverIds.has(player.playerId));
}

async function drawMatchesDraft(
  editionId: string,
  approvedGroups: Array<{ playerIds: string[] }>,
): Promise<boolean> {
  const response = await fetchEditionGroups(editionId);
  const groupStage = response.groups.filter((entry) => entry.group.phase === 'GROUP_STAGE');
  if (groupStage.length !== approvedGroups.length) {
    return false;
  }

  const serverSets = groupStage.map(
    (entry) => new Set(entry.players.map((player) => player.playerId)),
  );

  return approvedGroups.every((approved) =>
    serverSets.some((serverSet) => samePlayerSet(approved.playerIds, [...serverSet])),
  );
}

async function matchesAlreadyGenerated(
  editionId: string,
  groupSizes: readonly number[],
): Promise<boolean> {
  const edition = await fetchEdition(editionId);
  if (
    edition.status !== 'EM_ANDAMENTO' &&
    edition.status !== 'FASE_COLOCACAO' &&
    edition.status !== 'ENCERRADA'
  ) {
    return false;
  }

  const response = await fetchEditionMatches(editionId);
  const expected = estimateRoundRobinMatches(groupSizes);
  return response.matches.length >= expected && expected > 0;
}

export async function syncEditionWizardDraft(draft: EditionWizardDraft): Promise<WizardSyncResult> {
  if (!getOnlineStatus()) {
    return { status: 'error', message: 'Sem conexão com a internet.' };
  }

  if (!draft.groupCount || !draft.groupSizes || !draft.seedPlayerIds) {
    return { status: 'error', message: 'Complete todos os passos antes de sincronizar.' };
  }

  if (!draft.drawRandomSeed || !draft.drawPreview?.length) {
    return { status: 'error', message: 'Execute o sorteio antes de publicar.' };
  }

  if (isDrawPreviewStale(draft)) {
    return {
      status: 'error',
      message: 'A configuração mudou desde o sorteio. Volte ao passo Seeds e recalcule os grupos.',
    };
  }

  let workingDraft = await saveEditionWizardDraft({
    ...draft,
    syncStatus: 'SINCRONIZANDO',
    syncError: undefined,
  });

  try {
    let editionId = workingDraft.editionId;
    const idRemap = new Map<string, string>();

    for (const player of workingDraft.checkedInPlayers.filter((entry) => entry.isNew)) {
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
      workingDraft = await saveEditionWizardDraft(remapDraftPlayerIds(workingDraft, idRemap));
    }

    if (
      !workingDraft.drawRandomSeed ||
      !workingDraft.drawPreview?.length ||
      isDrawPreviewStale(workingDraft)
    ) {
      throw new Error(
        'Jogadores sincronizados com novos IDs. Volte ao passo Seeds e recalcule o sorteio.',
      );
    }

    const approvedGroups = buildApprovedGroupsFromDraft(workingDraft);
    if (!approvedGroups) {
      throw new Error('A prévia aprovada do sorteio não está disponível. Refaça o sorteio.');
    }

    if (!editionId) {
      const created = await createEdition({
        championshipId: workingDraft.championshipId,
        date: workingDraft.date,
        autoConfirmMinutes: workingDraft.autoConfirmMinutes,
      });
      const edition = created.editions[0];
      if (!edition) {
        throw new Error('Não foi possível criar a edição.');
      }
      editionId = edition.id;
      workingDraft = await saveEditionWizardDraft({
        ...workingDraft,
        editionId,
        syncStatus: 'SINCRONIZANDO',
      });
    }

    for (const player of workingDraft.checkedInPlayers) {
      try {
        await registerPlayer(editionId, { playerId: player.playerId });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) {
          throw error;
        }

        const registered = await playerIsRegistered(editionId, player.playerId).catch(() => false);
        if (!registered) {
          return saveConflict(
            workingDraft,
            editionId,
            error.message ||
              'Inscrição conflitou com o servidor e o jogador não está na lista oficial.',
          );
        }
      }
    }

    if (!(await registrationsMatchDraft(editionId, workingDraft))) {
      return saveConflict(
        workingDraft,
        editionId,
        'A lista de inscritos no servidor não corresponde ao rascunho local.',
      );
    }

    const drawBody: ExecuteDrawBody = {
      randomSeed: workingDraft.drawRandomSeed,
      groupCount: workingDraft.groupCount,
      groupSizes: workingDraft.groupSizes,
      seedPlayerIds: workingDraft.seedPlayerIds,
      approvedGroups,
    };

    try {
      await executeDraw(editionId, drawBody);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) {
        throw error;
      }

      const groupsMatch = await drawMatchesDraft(editionId, approvedGroups).catch(() => false);
      if (!groupsMatch) {
        return saveConflict(
          workingDraft,
          editionId,
          error.message ||
            'O sorteio no servidor difere da prévia local. Atualize e refaça a publicação.',
        );
      }
    }

    try {
      await generateMatches(editionId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) {
        throw error;
      }

      const ok = await matchesAlreadyGenerated(editionId, workingDraft.groupSizes!).catch(
        () => false,
      );
      if (!ok) {
        return saveConflict(
          workingDraft,
          editionId,
          error.message || 'As partidas no servidor não correspondem ao rascunho local.',
        );
      }
    }

    await saveEditionWizardDraft({
      ...workingDraft,
      editionId,
      syncStatus: 'SINCRONIZADO',
      syncError: undefined,
    });

    await deleteEditionWizardDraft(workingDraft.id);

    return { status: 'synced', editionId };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Falha ao sincronizar o rascunho.';

    await saveEditionWizardDraft({
      ...workingDraft,
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
    draft.drawRandomSeed !== undefined &&
    draft.drawPreview !== undefined &&
    draft.drawPreview.length > 0 &&
    !isDrawPreviewStale(draft)
  );
}

export function resolveEditionNameAfterSync(draft: EditionWizardDraft, edition?: Edition): string {
  return edition?.name ?? draft.predictedEditionName;
}
