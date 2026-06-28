import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/clandestino-db.js';
import {
  createEditionWizardDraft,
  getEditionWizardDraft,
  removeCheckedInPlayer,
  upsertCheckedInPlayer,
} from './edition-wizard-draft.js';

describe('edition wizard draft', () => {
  beforeEach(async () => {
    await db.editionWizardDraft.clear();
  });

  it('creates and loads a local draft', async () => {
    const draft = await createEditionWizardDraft({
      championshipId: '11111111-1111-4111-8111-111111111111',
      predictedEditionName: 'Clandestino #3',
      date: '2026-06-28',
      autoConfirmMinutes: 15,
    });

    const loaded = await getEditionWizardDraft(draft.id);
    expect(loaded?.predictedEditionName).toBe('Clandestino #3');
    expect(loaded?.currentStep).toBe(2);
  });

  it('tracks checked-in players', async () => {
    const draft = await createEditionWizardDraft({
      championshipId: '11111111-1111-4111-8111-111111111111',
      predictedEditionName: 'Clandestino #3',
      date: '2026-06-28',
      autoConfirmMinutes: 15,
    });

    const withPlayer = upsertCheckedInPlayer(draft, {
      playerId: '22222222-2222-4222-8222-222222222222',
      playerName: 'Ana',
      accumulatedPoints: 0,
    });
    const withoutPlayer = removeCheckedInPlayer(withPlayer, '22222222-2222-4222-8222-222222222222');

    expect(withPlayer.checkedInPlayers).toHaveLength(1);
    expect(withoutPlayer.checkedInPlayers).toHaveLength(0);
  });
});
