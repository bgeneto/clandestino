import type { EditionWizardDraft, WizardDraftPlayer } from '../db/clandestino-db.js';
import { db } from '../db/clandestino-db.js';

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}`;
}

export async function createEditionWizardDraft(
  input: Pick<
    EditionWizardDraft,
    'championshipId' | 'predictedEditionName' | 'date' | 'autoConfirmMinutes'
  > & { editionId?: string },
): Promise<EditionWizardDraft> {
  const draft: EditionWizardDraft = {
    id: createDraftId(),
    championshipId: input.championshipId,
    editionId: input.editionId,
    predictedEditionName: input.predictedEditionName,
    date: input.date,
    autoConfirmMinutes: input.autoConfirmMinutes,
    currentStep: 2,
    checkedInPlayers: [],
    syncStatus: input.editionId ? 'RASCUNHO_LOCAL' : 'PRONTO_PARA_SINCRONIZAR',
    updatedAt: new Date().toISOString(),
  };

  await db.editionWizardDraft.put(draft);
  return draft;
}

export async function getEditionWizardDraft(
  draftId: string,
): Promise<EditionWizardDraft | undefined> {
  return db.editionWizardDraft.get(draftId);
}

export async function getEditionWizardDraftByEditionId(
  editionId: string,
): Promise<EditionWizardDraft | undefined> {
  return db.editionWizardDraft.where('editionId').equals(editionId).first();
}

export async function saveEditionWizardDraft(
  draft: EditionWizardDraft,
): Promise<EditionWizardDraft> {
  const nextDraft: EditionWizardDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  await db.editionWizardDraft.put(nextDraft);
  return nextDraft;
}

export async function updateEditionWizardDraft(
  draftId: string,
  patch: Partial<EditionWizardDraft>,
): Promise<EditionWizardDraft> {
  const current = await getEditionWizardDraft(draftId);
  if (!current) {
    throw new Error('Rascunho do wizard não encontrado.');
  }

  return saveEditionWizardDraft({ ...current, ...patch, id: draftId });
}

export function getCheckedInPlayerIds(draft: EditionWizardDraft): string[] {
  return draft.checkedInPlayers.map((player) => player.playerId);
}

export function upsertCheckedInPlayer(
  draft: EditionWizardDraft,
  player: WizardDraftPlayer,
): EditionWizardDraft {
  const existingIndex = draft.checkedInPlayers.findIndex(
    (entry) => entry.playerId === player.playerId,
  );

  if (existingIndex >= 0) {
    const checkedInPlayers = [...draft.checkedInPlayers];
    checkedInPlayers[existingIndex] = player;
    return { ...draft, checkedInPlayers };
  }

  return {
    ...draft,
    checkedInPlayers: [...draft.checkedInPlayers, player],
  };
}

export function removeCheckedInPlayer(
  draft: EditionWizardDraft,
  playerId: string,
): EditionWizardDraft {
  return {
    ...draft,
    checkedInPlayers: draft.checkedInPlayers.filter((player) => player.playerId !== playerId),
  };
}

export async function deleteEditionWizardDraft(draftId: string): Promise<void> {
  await db.editionWizardDraft.delete(draftId);
}
