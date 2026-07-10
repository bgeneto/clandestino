import { describe, expect, it } from 'vitest';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { buildDrawPlanFromDraft } from './sync-wizard-draw-plan.js';

describe('buildDrawPlanFromDraft', () => {
  it('preserves the approved preview and random seed for later publication', () => {
    const draft: EditionWizardDraft = {
      id: 'draft-1',
      championshipId: '11111111-1111-4111-8111-111111111111',
      editionId: '22222222-2222-4222-8222-222222222222',
      predictedEditionName: 'Clandestino #1',
      date: '2026-07-10',
      autoConfirmMinutes: 15,
      currentStep: 5,
      checkedInPlayers: [],
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
      drawRandomSeed: 'preview-seed',
      drawPreview: [
        {
          name: 'Grupo A',
          players: [
            { playerId: 'a', playerName: 'Ana', isSeed: true },
            { playerId: 'c', playerName: 'Carla', isSeed: false },
            { playerId: 'e', playerName: 'Eva', isSeed: false },
          ],
        },
        {
          name: 'Grupo B',
          players: [
            { playerId: 'b', playerName: 'Bruno', isSeed: true },
            { playerId: 'd', playerName: 'Diego', isSeed: false },
            { playerId: 'f', playerName: 'Fabio', isSeed: false },
          ],
        },
      ],
      syncStatus: 'RASCUNHO_LOCAL',
      updatedAt: '2026-07-10T12:00:00.000Z',
    };

    expect(buildDrawPlanFromDraft(draft)).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
      randomSeed: 'preview-seed',
      approvedGroups: [{ playerIds: ['a', 'c', 'e'] }, { playerIds: ['b', 'd', 'f'] }],
    });
  });
});
