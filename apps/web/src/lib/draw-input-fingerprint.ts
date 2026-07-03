import { executeExplicitDraw } from '@clandestino/tournament-engine';
import type {
  EditionWizardDraft,
  WizardDrawPreviewGroup,
  WizardDraftPlayer,
} from '../db/clandestino-db.js';

export function canonicalSeedOrder(
  seedPlayerIds: readonly string[],
  checkedInPlayers: readonly WizardDraftPlayer[],
): string[] {
  const playerById = new Map(checkedInPlayers.map((player) => [player.playerId, player]));
  const seeds = seedPlayerIds
    .map((playerId) => playerById.get(playerId))
    .filter((player): player is WizardDraftPlayer => player !== undefined);

  return [...seeds]
    .sort((left, right) => {
      if (right.accumulatedPoints !== left.accumulatedPoints) {
        return right.accumulatedPoints - left.accumulatedPoints;
      }

      return left.playerName.localeCompare(right.playerName, 'pt-BR');
    })
    .map((player) => player.playerId);
}

function sortedPlayerIds(checkedInPlayers: readonly WizardDraftPlayer[]): string[] {
  return [...checkedInPlayers.map((player) => player.playerId)].sort();
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function buildDrawInputFingerprint(draft: EditionWizardDraft): string | undefined {
  if (!draft.groupSizes?.length || !draft.seedPlayerIds?.length) {
    return undefined;
  }

  return stableStringify({
    playerIds: sortedPlayerIds(draft.checkedInPlayers),
    seedPlayerIds: canonicalSeedOrder(draft.seedPlayerIds, draft.checkedInPlayers),
    groupSizes: draft.groupSizes,
  });
}

export function needsNewDrawPreview(draft: EditionWizardDraft): boolean {
  if (!draft.drawPreview?.length || !draft.drawRandomSeed) {
    return true;
  }

  const currentFingerprint = buildDrawInputFingerprint(draft);
  if (!currentFingerprint) {
    return true;
  }

  return draft.drawInputFingerprint !== currentFingerprint;
}

export function isDrawPreviewStale(draft: EditionWizardDraft): boolean {
  if (!draft.drawPreview?.length) {
    return false;
  }

  return needsNewDrawPreview(draft);
}

const DRAW_PREVIEW_CLEAR = {
  drawPreview: undefined,
  drawRandomSeed: undefined,
  drawInputFingerprint: undefined,
} as const;

export function clearDrawPreviewFields(draft: EditionWizardDraft): EditionWizardDraft {
  return { ...draft, ...DRAW_PREVIEW_CLEAR };
}

export function applyDraftMutation(
  draft: EditionWizardDraft,
  patch: Partial<EditionWizardDraft>,
): EditionWizardDraft {
  return invalidateStaleDrawPreview({ ...draft, ...patch });
}

export function invalidateStaleDrawPreview(draft: EditionWizardDraft): EditionWizardDraft {
  if (draft.drawInputFingerprint === undefined) {
    return draft;
  }

  const nextFingerprint = buildDrawInputFingerprint(draft);
  if (nextFingerprint === draft.drawInputFingerprint) {
    return draft;
  }

  return clearDrawPreviewFields(draft);
}

export function remapDrawPreviewPlayerIds(
  preview: WizardDrawPreviewGroup[] | undefined,
  idRemap: ReadonlyMap<string, string>,
): WizardDrawPreviewGroup[] | undefined {
  if (!preview?.length || idRemap.size === 0) {
    return preview;
  }

  return preview.map((group) => ({
    ...group,
    players: group.players.map((player) => ({
      ...player,
      playerId: idRemap.get(player.playerId) ?? player.playerId,
    })),
  }));
}

export function remapDraftPlayerIds(
  draft: EditionWizardDraft,
  idRemap: ReadonlyMap<string, string>,
): EditionWizardDraft {
  if (idRemap.size === 0) {
    return draft;
  }

  const remapId = (playerId: string) => idRemap.get(playerId) ?? playerId;

  const remapped: EditionWizardDraft = {
    ...draft,
    checkedInPlayers: draft.checkedInPlayers.map((entry) => ({
      ...entry,
      playerId: remapId(entry.playerId),
      isNew: idRemap.has(entry.playerId) ? false : entry.isNew,
    })),
    seedPlayerIds: draft.seedPlayerIds?.map(remapId),
  };

  return clearDrawPreviewFields(remapped);
}

export function buildDrawPreview(
  draft: EditionWizardDraft,
  randomSeed: string,
): WizardDrawPreviewGroup[] {
  if (!draft.groupSizes?.length || !draft.seedPlayerIds?.length) {
    return [];
  }

  const seedPlayerIds = canonicalSeedOrder(draft.seedPlayerIds, draft.checkedInPlayers);
  const playerNameById = new Map(
    draft.checkedInPlayers.map((player) => [player.playerId, player.playerName]),
  );
  const draw = executeExplicitDraw({
    playerIds: draft.checkedInPlayers.map((player) => player.playerId),
    seedPlayerIds,
    groupSizes: draft.groupSizes,
    randomSeed,
  });

  return draw.groups.map((group) => ({
    name: group.name,
    players: group.players.map((player) => ({
      playerId: player.playerId,
      playerName: playerNameById.get(player.playerId) ?? 'Jogador',
      isSeed: player.isSeed,
    })),
  }));
}

export function withDrawPreview(draft: EditionWizardDraft, randomSeed: string): EditionWizardDraft {
  const seedPlayerIds = draft.seedPlayerIds
    ? canonicalSeedOrder(draft.seedPlayerIds, draft.checkedInPlayers)
    : draft.seedPlayerIds;

  const draftWithCanonicalSeeds = seedPlayerIds ? { ...draft, seedPlayerIds } : draft;

  const fingerprint = buildDrawInputFingerprint(draftWithCanonicalSeeds);
  const preview = buildDrawPreview(draftWithCanonicalSeeds, randomSeed);

  return {
    ...draftWithCanonicalSeeds,
    drawRandomSeed: randomSeed,
    drawPreview: preview,
    drawInputFingerprint: fingerprint,
    syncStatus: draft.syncStatus === 'SINCRONIZADO' ? 'SINCRONIZADO' : 'PRONTO_PARA_SINCRONIZAR',
  };
}
