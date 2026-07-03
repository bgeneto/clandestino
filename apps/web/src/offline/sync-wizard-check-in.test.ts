import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { ApiError } from '../lib/api-client.js';
import {
  draftMissingServerRegistrations,
  isLocalOnlyPlayerId,
  mergeDraftWithServerRegistrations,
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

describe('sync-wizard-check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
