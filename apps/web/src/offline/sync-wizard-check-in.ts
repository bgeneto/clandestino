import type { EditionRegistration } from '@clandestino/shared-contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { EditionWizardDraft, WizardDraftPlayer } from '../db/clandestino-db.js';
import { ApiError } from '../lib/api-client.js';
import { queryKeys } from '../lib/query-keys.js';
import { createPlayer, registerPlayer, unregisterPlayer } from '../lib/organizer-api.js';

export function isLocalOnlyPlayerId(playerId: string): boolean {
  return playerId.startsWith('local-');
}

export function mergeDraftWithServerRegistrations(
  draft: EditionWizardDraft,
  registrations: EditionRegistration[],
  rosterByPlayerId: Map<string, { playerName: string; accumulatedPoints: number }>,
): EditionWizardDraft {
  const checkedInIds = new Set(draft.checkedInPlayers.map((player) => player.playerId));
  const mergedPlayers = [...draft.checkedInPlayers];

  for (const registration of registrations) {
    if (checkedInIds.has(registration.playerId)) {
      continue;
    }

    const roster = rosterByPlayerId.get(registration.playerId);
    mergedPlayers.push({
      playerId: registration.playerId,
      playerName: roster?.playerName ?? 'Jogador',
      accumulatedPoints: roster?.accumulatedPoints ?? 0,
      isNew: false,
    });
    checkedInIds.add(registration.playerId);
  }

  return { ...draft, checkedInPlayers: mergedPlayers };
}

export function draftMissingServerRegistrations(
  draft: EditionWizardDraft,
  registrations: EditionRegistration[],
): boolean {
  const checkedInIds = new Set(draft.checkedInPlayers.map((player) => player.playerId));
  return registrations.some((registration) => !checkedInIds.has(registration.playerId));
}

async function invalidateCheckInQueries(
  queryClient: QueryClient,
  editionId: string,
  championshipId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.registrations(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.participants(editionId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.championshipRoster(championshipId) }),
  ]);
}

async function ensureServerPlayerId(
  draft: EditionWizardDraft,
  player: WizardDraftPlayer,
): Promise<{ draft: EditionWizardDraft; playerId: string }> {
  if (!player.isNew || !isLocalOnlyPlayerId(player.playerId)) {
    return { draft, playerId: player.playerId };
  }

  const created = await createPlayer({ name: player.playerName });
  const remappedDraft: EditionWizardDraft = {
    ...draft,
    checkedInPlayers: draft.checkedInPlayers.map((entry) =>
      entry.playerId === player.playerId ? { ...entry, playerId: created.id, isNew: false } : entry,
    ),
    seedPlayerIds: draft.seedPlayerIds?.map((playerId) =>
      playerId === player.playerId ? created.id : playerId,
    ),
  };

  return { draft: remappedDraft, playerId: created.id };
}

async function registerOnServer(playerId: string, editionId: string): Promise<void> {
  try {
    await registerPlayer(editionId, { playerId });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409) {
      throw error;
    }
  }
}

export async function syncWizardCheckInToggle(params: {
  draft: EditionWizardDraft;
  player: WizardDraftPlayer;
  checkingIn: boolean;
  queryClient: QueryClient;
}): Promise<EditionWizardDraft> {
  const { draft, player, checkingIn, queryClient } = params;
  const editionId = draft.editionId;

  if (!editionId || !navigator.onLine) {
    return draft;
  }

  if (checkingIn) {
    const { draft: withServerId, playerId } = await ensureServerPlayerId(draft, player);
    await registerOnServer(playerId, editionId);
    await invalidateCheckInQueries(queryClient, editionId, draft.championshipId);
    return withServerId;
  }

  if (!isLocalOnlyPlayerId(player.playerId)) {
    await unregisterPlayer(editionId, player.playerId);
    await invalidateCheckInQueries(queryClient, editionId, draft.championshipId);
  }

  return draft;
}

export async function syncWizardAddNewPlayer(params: {
  draft: EditionWizardDraft;
  player: WizardDraftPlayer;
  queryClient: QueryClient;
}): Promise<EditionWizardDraft> {
  return syncWizardCheckInToggle({
    draft: params.draft,
    player: params.player,
    checkingIn: true,
    queryClient: params.queryClient,
  });
}
