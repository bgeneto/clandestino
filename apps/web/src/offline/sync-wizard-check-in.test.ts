import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { ApiError } from '../lib/api-client.js';
import {
  CHECK_IN_SYNC_DEBOUNCE_MS,
  draftMissingServerRegistrations,
  flushCheckInSync,
  isLocalOnlyPlayerId,
  mergeDraftWithServerRegistrations,
  reconcileCheckInWithServer,
  resetCheckInSyncStateForTests,
  scheduleWizardCheckInSync,
  syncWizardCheckInToggle,
} from './sync-wizard-check-in.js';

vi.mock('../lib/organizer-api.js', () => ({
  createPlayer: vi.fn(),
  registerPlayer: vi.fn(),
  unregisterPlayer: vi.fn(),
}));

import { createPlayer, registerPlayer, unregisterPlayer } from '../lib/organizer-api.js';

const baseDraft: EditionWizardDraft = {
  id: 'draft-1',
  championshipId: '11111111-1111-4111-8111-111111111111',
  editionId: '22222222-2222-4222-8222-222222222222',
  predictedEditionName: 'Clandestino #1',
  date: '2026-08-01',
  autoConfirmMinutes: 15,
  currentStep: 2,
  checkedInPlayers: [],
  syncStatus: 'RASCUNHO_LOCAL',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const queryClient = {
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
} as unknown as QueryClient;

function syncContext(
  overrides: {
    getDraft?: () => Promise<EditionWizardDraft | undefined>;
    persistDraft?: (draft: EditionWizardDraft) => Promise<EditionWizardDraft>;
  } = {},
) {
  let currentDraft: EditionWizardDraft = { ...baseDraft };
  return {
    draftId: baseDraft.id,
    editionId: baseDraft.editionId!,
    championshipId: baseDraft.championshipId,
    queryClient,
    getDraft: overrides.getDraft ?? (async () => currentDraft),
    persistDraft:
      overrides.persistDraft ??
      (async (draft: EditionWizardDraft) => {
        currentDraft = draft;
        return draft;
      }),
  };
}

describe('sync-wizard-check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCheckInSyncStateForTests();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCheckInSyncStateForTests();
  });

  it('detects local-only player ids', () => {
    expect(isLocalOnlyPlayerId('local-ana-123')).toBe(true);
    expect(isLocalOnlyPlayerId('33333333-3333-4333-8333-333333333333')).toBe(false);
  });

  it('merges server registrations missing from draft', () => {
    const draft: EditionWizardDraft = {
      ...baseDraft,
      checkedInPlayers: [
        {
          playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          playerName: 'Ana',
          accumulatedPoints: 10,
        },
      ],
    };

    const merged = mergeDraftWithServerRegistrations(
      draft,
      [
        {
          editionId: baseDraft.editionId!,
          playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          registeredAt: '2026-01-01T00:00:00.000Z',
        },
        {
          editionId: baseDraft.editionId!,
          playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          registeredAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      new Map([
        ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { playerName: 'Bruno', accumulatedPoints: 5 }],
      ]),
    );

    expect(merged.checkedInPlayers).toHaveLength(2);
    expect(merged.checkedInPlayers[1]?.playerName).toBe('Bruno');
  });

  it('skips merge for player ids marked as pending sync', () => {
    const merged = mergeDraftWithServerRegistrations(
      baseDraft,
      [
        {
          editionId: baseDraft.editionId!,
          playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          registeredAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      new Map([
        ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { playerName: 'Bruno', accumulatedPoints: 5 }],
      ]),
      new Set(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']),
    );

    expect(merged.checkedInPlayers).toHaveLength(0);
  });

  it('reports when draft is missing server registrations', () => {
    expect(
      draftMissingServerRegistrations(baseDraft, [
        {
          editionId: baseDraft.editionId!,
          playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          registeredAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    ).toBe(true);
  });

  it('registers a new player on check-in and remaps local id', async () => {
    vi.mocked(createPlayer).mockResolvedValue({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Carla',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(registerPlayer).mockResolvedValue({ registrations: [] });

    const player = {
      playerId: 'local-carla-1',
      playerName: 'Carla',
      accumulatedPoints: 0,
      isNew: true,
    };
    const draft: EditionWizardDraft = {
      ...baseDraft,
      checkedInPlayers: [player],
    };

    const result = await syncWizardCheckInToggle({
      draft,
      player,
      checkingIn: true,
      queryClient,
    });

    expect(createPlayer).toHaveBeenCalledWith({ name: 'Carla' });
    expect(registerPlayer).toHaveBeenCalledWith(baseDraft.editionId, {
      playerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expect(result.checkedInPlayers[0]?.playerId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(result.checkedInPlayers[0]?.isNew).toBe(false);
  });

  it('ignores duplicate registration conflicts', async () => {
    vi.mocked(registerPlayer).mockRejectedValue(new ApiError('Já inscrito', 409));

    const player = {
      playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      playerName: 'Ana',
      accumulatedPoints: 0,
    };
    const draft: EditionWizardDraft = {
      ...baseDraft,
      checkedInPlayers: [player],
    };

    await expect(
      syncWizardCheckInToggle({
        draft,
        player,
        checkingIn: true,
        queryClient,
      }),
    ).resolves.toEqual(draft);
  });

  it('unregisters existing players on check-out', async () => {
    vi.mocked(unregisterPlayer).mockResolvedValue({ registrations: [] });

    const player = {
      playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      playerName: 'Ana',
      accumulatedPoints: 0,
    };

    await syncWizardCheckInToggle({
      draft: baseDraft,
      player,
      checkingIn: false,
      queryClient,
    });

    expect(unregisterPlayer).toHaveBeenCalledWith(
      baseDraft.editionId,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('ignores unregister 404 when player is already absent', async () => {
    vi.mocked(unregisterPlayer).mockRejectedValue(
      new ApiError('Jogador não inscrito nesta edição.', 404),
    );

    const player = {
      playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      playerName: 'Ana',
      accumulatedPoints: 0,
    };

    await expect(
      syncWizardCheckInToggle({
        draft: baseDraft,
        player,
        checkingIn: false,
        queryClient,
      }),
    ).resolves.toEqual(baseDraft);
  });

  it('reconcile registers and unregisters only the diff', async () => {
    vi.mocked(registerPlayer).mockResolvedValue({ registrations: [] });
    vi.mocked(unregisterPlayer).mockResolvedValue({ registrations: [] });

    let currentDraft: EditionWizardDraft = {
      ...baseDraft,
      checkedInPlayers: [
        {
          playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          playerName: 'Bruno',
          accumulatedPoints: 5,
        },
      ],
    };

    const context = syncContext({
      getDraft: async () => currentDraft,
      persistDraft: async (draft) => {
        currentDraft = draft;
        return draft;
      },
    });

    await reconcileCheckInWithServer(context);

    expect(registerPlayer).toHaveBeenCalledWith(baseDraft.editionId, {
      playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(unregisterPlayer).not.toHaveBeenCalled();

    currentDraft = {
      ...currentDraft,
      checkedInPlayers: [],
    };

    await reconcileCheckInWithServer(context);

    expect(unregisterPlayer).toHaveBeenCalledWith(
      baseDraft.editionId,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );
    expect(registerPlayer).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid toggles into a single reconcile', async () => {
    vi.useFakeTimers();
    vi.mocked(registerPlayer).mockResolvedValue({ registrations: [] });
    vi.mocked(unregisterPlayer).mockResolvedValue({ registrations: [] });

    let currentDraft: EditionWizardDraft = baseDraft;
    const context = syncContext({
      getDraft: async () => currentDraft,
      persistDraft: async (draft) => {
        currentDraft = draft;
        return draft;
      },
    });

    currentDraft = {
      ...baseDraft,
      checkedInPlayers: [
        {
          playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          playerName: 'Ana',
          accumulatedPoints: 0,
        },
      ],
    };
    scheduleWizardCheckInSync(context);

    currentDraft = { ...baseDraft, checkedInPlayers: [] };
    scheduleWizardCheckInSync(context);

    await vi.advanceTimersByTimeAsync(CHECK_IN_SYNC_DEBOUNCE_MS);

    expect(registerPlayer).not.toHaveBeenCalled();
    expect(unregisterPlayer).not.toHaveBeenCalled();
  });

  it('flush runs reconcile immediately without waiting for debounce', async () => {
    vi.useFakeTimers();
    vi.mocked(registerPlayer).mockResolvedValue({ registrations: [] });

    let currentDraft: EditionWizardDraft = {
      ...baseDraft,
      checkedInPlayers: [
        {
          playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          playerName: 'Ana',
          accumulatedPoints: 0,
        },
      ],
    };

    const context = syncContext({
      getDraft: async () => currentDraft,
      persistDraft: async (draft) => {
        currentDraft = draft;
        return draft;
      },
    });

    scheduleWizardCheckInSync(context);
    await flushCheckInSync(context);

    expect(registerPlayer).toHaveBeenCalledTimes(1);
  });
});
