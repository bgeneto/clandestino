import type { EditionRegistration } from '@clandestino/shared-contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { EditionWizardDraft, WizardDraftPlayer } from '../db/clandestino-db.js';
import { ApiError } from '../lib/api-client.js';
import { applyDraftMutation, remapDraftPlayerIds } from '../lib/draw-input-fingerprint.js';
import { getOnlineStatus } from '../lib/online-status.js';
import { queryKeys } from '../lib/query-keys.js';
import { createPlayer, registerPlayer, unregisterPlayer } from '../lib/organizer-api.js';

export const CHECK_IN_SYNC_DEBOUNCE_MS = 1500;

export function isLocalOnlyPlayerId(playerId: string): boolean {
  return playerId.startsWith('local-');
}

const lastSyncedRegistrationIds = new Map<string, Set<string>>();
const pendingCheckInSyncByDraft = new Map<string, Set<string>>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const syncQueues = new Map<string, Promise<void>>();

type CheckInSyncContext = {
  draftId: string;
  editionId: string;
  championshipId: string;
  queryClient: QueryClient;
  getDraft: () => Promise<EditionWizardDraft | undefined>;
  persistDraft: (draft: EditionWizardDraft) => Promise<EditionWizardDraft>;
  onError?: (error: unknown) => void;
};

export function initLastSyncedRegistrations(
  draftId: string,
  registrations: EditionRegistration[],
): void {
  if (lastSyncedRegistrationIds.has(draftId)) {
    return;
  }

  lastSyncedRegistrationIds.set(
    draftId,
    new Set(registrations.map((registration) => registration.playerId)),
  );
}

export function getPendingCheckInSyncPlayerIds(draftId: string): ReadonlySet<string> {
  return pendingCheckInSyncByDraft.get(draftId) ?? new Set();
}

export function isCheckInSyncPending(draftId: string): boolean {
  return debounceTimers.has(draftId) || pendingCheckInSyncByDraft.has(draftId);
}

export function mergeDraftWithServerRegistrations(
  draft: EditionWizardDraft,
  registrations: EditionRegistration[],
  rosterByPlayerId: Map<string, { playerName: string; accumulatedPoints: number }>,
  skipPlayerIds: ReadonlySet<string> = new Set(),
): EditionWizardDraft {
  const checkedInIds = new Set(draft.checkedInPlayers.map((player) => player.playerId));
  const mergedPlayers = [...draft.checkedInPlayers];

  for (const registration of registrations) {
    if (checkedInIds.has(registration.playerId) || skipPlayerIds.has(registration.playerId)) {
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

  return applyDraftMutation(draft, { checkedInPlayers: mergedPlayers });
}

export function draftMissingServerRegistrations(
  draft: EditionWizardDraft,
  registrations: EditionRegistration[],
  skipPlayerIds: ReadonlySet<string> = new Set(),
): boolean {
  const checkedInIds = new Set(draft.checkedInPlayers.map((player) => player.playerId));
  return registrations.some(
    (registration) =>
      !checkedInIds.has(registration.playerId) && !skipPlayerIds.has(registration.playerId),
  );
}

function computeCheckInDiff(
  desiredIds: ReadonlySet<string>,
  lastSyncedIds: ReadonlySet<string>,
): { toRegister: string[]; toUnregister: string[] } {
  const toRegister: string[] = [];
  const toUnregister: string[] = [];

  for (const playerId of desiredIds) {
    if (!lastSyncedIds.has(playerId) && !isLocalOnlyPlayerId(playerId)) {
      toRegister.push(playerId);
    }
  }

  for (const playerId of lastSyncedIds) {
    if (!desiredIds.has(playerId)) {
      toUnregister.push(playerId);
    }
  }

  return { toRegister, toUnregister };
}

function updatePendingCheckInSync(draftId: string, draft: EditionWizardDraft): void {
  const lastSynced = lastSyncedRegistrationIds.get(draftId) ?? new Set<string>();
  const desired = new Set(draft.checkedInPlayers.map((player) => player.playerId));
  const pending = new Set<string>([...desired, ...lastSynced]);
  pendingCheckInSyncByDraft.set(draftId, pending);
}

function clearPendingCheckInSync(draftId: string): void {
  pendingCheckInSyncByDraft.delete(draftId);
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

async function ensureServerPlayerIds(
  draft: EditionWizardDraft,
): Promise<{ draft: EditionWizardDraft; remapped: boolean }> {
  const idRemap = new Map<string, string>();

  for (const player of draft.checkedInPlayers) {
    if (!player.isNew || !isLocalOnlyPlayerId(player.playerId)) {
      continue;
    }

    const created = await createPlayer({ name: player.playerName });
    idRemap.set(player.playerId, created.id);
  }

  if (idRemap.size === 0) {
    return { draft, remapped: false };
  }

  return { draft: remapDraftPlayerIds(draft, idRemap), remapped: true };
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

async function unregisterOnServer(playerId: string, editionId: string): Promise<void> {
  try {
    await unregisterPlayer(editionId, playerId);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }
}

async function ensureServerPlayerId(
  draft: EditionWizardDraft,
  player: WizardDraftPlayer,
): Promise<{ draft: EditionWizardDraft; playerId: string }> {
  if (!player.isNew || !isLocalOnlyPlayerId(player.playerId)) {
    return { draft, playerId: player.playerId };
  }

  const created = await createPlayer({ name: player.playerName });
  const idRemap = new Map([[player.playerId, created.id]]);
  const remappedDraft = remapDraftPlayerIds(draft, idRemap);

  return { draft: remappedDraft, playerId: created.id };
}

function enqueueEditionSync(editionId: string, task: () => Promise<void>): Promise<void> {
  const previous = syncQueues.get(editionId) ?? Promise.resolve();
  const next = previous.then(task).catch(() => undefined);
  syncQueues.set(editionId, next);
  return next;
}

export async function reconcileCheckInWithServer(
  context: CheckInSyncContext,
): Promise<EditionWizardDraft | undefined> {
  const { draftId, editionId, championshipId, queryClient, getDraft, persistDraft } = context;

  if (!getOnlineStatus()) {
    return getDraft();
  }

  let draft = await getDraft();
  if (!draft) {
    return undefined;
  }

  updatePendingCheckInSync(draftId, draft);

  try {
    const ensured = await ensureServerPlayerIds(draft);
    draft = ensured.remapped ? await persistDraft(ensured.draft) : ensured.draft;

    const desiredIds = new Set(
      draft.checkedInPlayers
        .map((player) => player.playerId)
        .filter((playerId) => !isLocalOnlyPlayerId(playerId)),
    );
    const lastSynced = lastSyncedRegistrationIds.get(draftId) ?? new Set<string>();
    const { toRegister, toUnregister } = computeCheckInDiff(desiredIds, lastSynced);

    for (const playerId of toRegister) {
      await registerOnServer(playerId, editionId);
    }

    for (const playerId of toUnregister) {
      await unregisterOnServer(playerId, editionId);
    }

    if (toRegister.length > 0 || toUnregister.length > 0) {
      await invalidateCheckInQueries(queryClient, editionId, championshipId);
    }

    lastSyncedRegistrationIds.set(draftId, new Set(desiredIds));
    return draft;
  } finally {
    clearPendingCheckInSync(draftId);
  }
}

function runQueuedReconcile(context: CheckInSyncContext): Promise<EditionWizardDraft | undefined> {
  return new Promise((resolve, reject) => {
    void enqueueEditionSync(context.editionId, async () => {
      try {
        const result = await reconcileCheckInWithServer(context);
        resolve(result);
      } catch (error) {
        context.onError?.(error);
        reject(error);
      }
    });
  });
}

export function scheduleWizardCheckInSync(context: CheckInSyncContext): void {
  if (!getOnlineStatus()) {
    return;
  }

  void context.getDraft().then((draft) => {
    if (!draft) {
      return;
    }

    updatePendingCheckInSync(context.draftId, draft);
  });

  const existingTimer = debounceTimers.get(context.draftId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(context.draftId);
    void runQueuedReconcile(context);
  }, CHECK_IN_SYNC_DEBOUNCE_MS);

  debounceTimers.set(context.draftId, timer);
}

export async function flushCheckInSync(
  context: CheckInSyncContext,
): Promise<EditionWizardDraft | undefined> {
  const existingTimer = debounceTimers.get(context.draftId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    debounceTimers.delete(context.draftId);
  }

  if (!getOnlineStatus()) {
    return context.getDraft();
  }

  return runQueuedReconcile(context);
}

export async function syncWizardCheckInToggle(params: {
  draft: EditionWizardDraft;
  player: WizardDraftPlayer;
  checkingIn: boolean;
  queryClient: QueryClient;
}): Promise<EditionWizardDraft> {
  const { draft, player, checkingIn, queryClient } = params;
  const editionId = draft.editionId;

  if (!editionId || !getOnlineStatus()) {
    return draft;
  }

  if (checkingIn) {
    const { draft: withServerId, playerId } = await ensureServerPlayerId(draft, player);
    await registerOnServer(playerId, editionId);
    await invalidateCheckInQueries(queryClient, editionId, draft.championshipId);
    return withServerId;
  }

  if (!isLocalOnlyPlayerId(player.playerId)) {
    await unregisterOnServer(player.playerId, editionId);
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

/** @internal Resets module state — for tests only. */
export function resetCheckInSyncStateForTests(): void {
  lastSyncedRegistrationIds.clear();
  pendingCheckInSyncByDraft.clear();
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  syncQueues.clear();
}
