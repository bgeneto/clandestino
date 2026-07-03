import { describe, expect, it } from 'vitest';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import {
  applyDraftMutation,
  buildDrawInputFingerprint,
  canonicalSeedOrder,
  invalidateStaleDrawPreview,
  isDrawPreviewStale,
  needsNewDrawPreview,
  remapDrawPreviewPlayerIds,
  remapDraftPlayerIds,
  withDrawPreview,
} from './draw-input-fingerprint.js';

const playerA = {
  playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  playerName: 'Ana',
  accumulatedPoints: 30,
};
const playerB = {
  playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  playerName: 'Bruno',
  accumulatedPoints: 20,
};
const playerC = {
  playerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  playerName: 'Carla',
  accumulatedPoints: 10,
};
const playerD = {
  playerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  playerName: 'Diego',
  accumulatedPoints: 0,
};

function baseDraft(overrides: Partial<EditionWizardDraft> = {}): EditionWizardDraft {
  return {
    id: 'draft-1',
    championshipId: '11111111-1111-4111-8111-111111111111',
    predictedEditionName: 'Clandestino #1',
    date: '2026-08-01',
    autoConfirmMinutes: 15,
    currentStep: 4,
    checkedInPlayers: [playerA, playerB, playerC, playerD],
    groupCount: 2,
    groupSizes: [2, 2],
    seedPlayerIds: [playerA.playerId, playerB.playerId],
    syncStatus: 'RASCUNHO_LOCAL',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('draw-input-fingerprint', () => {
  it('orders seeds by ranking regardless of selection order', () => {
    const seeds = canonicalSeedOrder(
      [playerC.playerId, playerA.playerId],
      [playerA, playerB, playerC, playerD],
    );

    expect(seeds).toEqual([playerA.playerId, playerC.playerId]);
  });

  it('builds stable fingerprint for identical draw inputs', () => {
    const draft = baseDraft();
    const reorderedSeeds = baseDraft({
      seedPlayerIds: [playerB.playerId, playerA.playerId],
    });

    expect(buildDrawInputFingerprint(draft)).toBe(buildDrawInputFingerprint(reorderedSeeds));
  });

  it('preserves preview when fingerprint is unchanged', () => {
    const draft = withDrawPreview(baseDraft(), 'seed-abc');
    const fingerprint = draft.drawInputFingerprint;

    const afterNavigation = invalidateStaleDrawPreview({
      ...draft,
      currentStep: 5,
    });

    expect(afterNavigation.drawPreview).toEqual(draft.drawPreview);
    expect(afterNavigation.drawRandomSeed).toBe('seed-abc');
    expect(afterNavigation.drawInputFingerprint).toBe(fingerprint);
    expect(needsNewDrawPreview(afterNavigation)).toBe(false);
  });

  it('invalidates preview when players change', () => {
    const draft = withDrawPreview(baseDraft(), 'seed-abc');
    const withoutPlayer = invalidateStaleDrawPreview({
      ...draft,
      checkedInPlayers: [playerA, playerB, playerC],
      groupSizes: [2, 1],
    });

    expect(withoutPlayer.drawPreview).toBeUndefined();
    expect(withoutPlayer.drawRandomSeed).toBeUndefined();
    expect(isDrawPreviewStale(draft)).toBe(false);
    expect(isDrawPreviewStale(withoutPlayer)).toBe(false);
    expect(needsNewDrawPreview(withoutPlayer)).toBe(true);
  });

  it('invalidates preview when seeds change', () => {
    const draft = withDrawPreview(baseDraft(), 'seed-abc');
    const newSeeds = applyDraftMutation(draft, {
      seedPlayerIds: [playerA.playerId, playerC.playerId],
    });

    expect(newSeeds.drawPreview).toBeUndefined();
    expect(needsNewDrawPreview(newSeeds)).toBe(true);
  });

  it('does not invalidate when seed set is the same but click order differed', () => {
    const draft = withDrawPreview(baseDraft(), 'seed-abc');
    const sameSeedsDifferentOrder = applyDraftMutation(draft, {
      seedPlayerIds: [playerB.playerId, playerA.playerId],
    });

    expect(sameSeedsDifferentOrder.drawPreview).toEqual(draft.drawPreview);
    expect(sameSeedsDifferentOrder.drawRandomSeed).toBe('seed-abc');
    expect(needsNewDrawPreview(sameSeedsDifferentOrder)).toBe(false);
  });

  it('invalidates preview after merge adds a server registration', () => {
    const draft = withDrawPreview(baseDraft(), 'seed-abc');
    const merged = applyDraftMutation(draft, {
      checkedInPlayers: [
        ...draft.checkedInPlayers,
        {
          playerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          playerName: 'Edu',
          accumulatedPoints: 0,
        },
      ],
      groupSizes: [3, 2],
      groupCount: 2,
    });

    expect(merged.drawPreview).toBeUndefined();
    expect(
      isDrawPreviewStale({
        ...draft,
        checkedInPlayers: merged.checkedInPlayers,
        groupSizes: merged.groupSizes,
        groupCount: merged.groupCount,
      }),
    ).toBe(true);
  });

  it('remaps preview player ids for display helpers', () => {
    const preview = [
      {
        name: 'Grupo A',
        players: [
          { playerId: 'local-ana-1', playerName: 'Ana', isSeed: true },
          { playerId: playerB.playerId, playerName: 'Bruno', isSeed: false },
        ],
      },
    ];
    const remapped = remapDrawPreviewPlayerIds(
      preview,
      new Map([['local-ana-1', playerA.playerId]]),
    );

    expect(remapped?.[0]?.players[0]?.playerId).toBe(playerA.playerId);
  });

  it('clears preview when draft player ids are remapped to server ids', () => {
    const draft = withDrawPreview(
      baseDraft({
        checkedInPlayers: [
          { playerId: 'local-ana-1', playerName: 'Ana', accumulatedPoints: 30, isNew: true },
          playerB,
          playerC,
          playerD,
        ],
        seedPlayerIds: ['local-ana-1', playerB.playerId],
      }),
      'seed-abc',
    );

    const remapped = remapDraftPlayerIds(draft, new Map([['local-ana-1', playerA.playerId]]));

    expect(remapped.checkedInPlayers[0]?.playerId).toBe(playerA.playerId);
    expect(remapped.seedPlayerIds).toEqual([playerA.playerId, playerB.playerId]);
    expect(remapped.drawPreview).toBeUndefined();
    expect(remapped.drawRandomSeed).toBeUndefined();
    expect(needsNewDrawPreview(remapped)).toBe(true);
  });

  it('stores canonical seeds when building preview', () => {
    const draft = withDrawPreview(
      baseDraft({ seedPlayerIds: [playerB.playerId, playerA.playerId] }),
      'seed-abc',
    );

    expect(draft.seedPlayerIds).toEqual([playerA.playerId, playerB.playerId]);
    expect(draft.drawPreview?.length).toBeGreaterThan(0);
    expect(draft.drawInputFingerprint).toBeDefined();
  });
});
