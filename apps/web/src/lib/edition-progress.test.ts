import type { Edition, Group, Match } from '@clandestino/shared-contracts';
import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import {
  GROUP_STAGE_PHASE,
  PLACEMENT_STAGE_PHASE,
  buildGroupsById,
  canFinalizeEdition,
  countPhaseMatchProgress,
  filterMatchesByPhase,
  formatPhaseMatchProgress,
  getEditionFinalizeBlockers,
  getPendingMatches,
  shouldShowFinalizeSection,
} from './edition-progress.js';

const groupStageGroup: Group = {
  id: 'group-a',
  editionId: 'edition-1',
  name: 'Grupo A',
  phase: GROUP_STAGE_PHASE,
};

const placementGroup: Group = {
  id: 'group-p',
  editionId: 'edition-1',
  name: 'Colocação A',
  phase: PLACEMENT_STAGE_PHASE,
};

function match(id: string, groupId: string, status: Match['status']): Match {
  return {
    id,
    editionId: 'edition-1',
    groupId,
    status,
    outcome: 'PLAYED',
    participants: [
      { playerId: 'p1', setsWon: 2 },
      { playerId: 'p2', setsWon: 0 },
    ],
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
  };
}

function edition(status: Edition['status']): Edition {
  return {
    id: 'edition-1',
    championshipId: 'championship-1',
    name: 'Clandestino #1',
    date: '2026-07-04',
    rules: DEFAULT_EDITION_RULES,
    status,
    autoConfirmMinutes: 15,
    createdAt: '2026-06-28T00:00:00.000Z',
  };
}

describe('edition-progress', () => {
  const groupsById = buildGroupsById([
    { group: groupStageGroup, players: [] },
    { group: placementGroup, players: [] },
  ]);

  it('filters matches by group phase', () => {
    const matches = [match('m1', 'group-a', 'CONFIRMADA'), match('m2', 'group-p', 'AGENDADA')];

    expect(filterMatchesByPhase(matches, groupsById, GROUP_STAGE_PHASE)).toHaveLength(1);
    expect(filterMatchesByPhase(matches, groupsById, PLACEMENT_STAGE_PHASE)).toHaveLength(1);
  });

  it('counts confirmed matches per phase', () => {
    const matches = [
      match('m1', 'group-a', 'CONFIRMADA'),
      match('m2', 'group-a', 'AGENDADA'),
      match('m3', 'group-p', 'CORRIGIDA'),
      match('m4', 'group-p', 'AGUARDANDO_CONFIRMACAO'),
    ];

    expect(countPhaseMatchProgress(matches, groupsById, GROUP_STAGE_PHASE)).toEqual({
      confirmed: 1,
      total: 2,
    });
    expect(countPhaseMatchProgress(matches, groupsById, PLACEMENT_STAGE_PHASE)).toEqual({
      confirmed: 1,
      total: 2,
    });
  });

  it('formats phase progress message', () => {
    expect(formatPhaseMatchProgress('grupos', 3, 6)).toBe('3/6 partidas de grupos confirmadas');
    expect(formatPhaseMatchProgress('grupos', 0, 0)).toBe('grupos');
  });

  it('lists pending organizer matches', () => {
    const matches = [
      match('m1', 'group-a', 'AGENDADA'),
      match('m2', 'group-a', 'AGUARDANDO_CONFIRMACAO'),
      match('m3', 'group-a', 'CONFIRMADA'),
      match('m4', 'group-a', 'CONTESTADA'),
    ];

    expect(getPendingMatches(matches).map((entry) => entry.id)).toEqual(['m1', 'm2']);
  });

  it('hides finalize section before tournament starts', () => {
    expect(shouldShowFinalizeSection('SORTEIO_PUBLICADO')).toBe(false);
    expect(shouldShowFinalizeSection('EM_ANDAMENTO')).toBe(true);
  });

  it('allows finalize for single-group FASE_COLOCACAO when matches are confirmed', () => {
    const groups = [{ group: groupStageGroup, players: [] }];
    const matches = [match('m1', 'group-a', 'CONFIRMADA'), match('m2', 'group-a', 'CONFIRMADA')];

    expect(canFinalizeEdition(edition('FASE_COLOCACAO'), matches, groups)).toBe(true);
  });

  it('blocks finalize when placement bands exist but are unpublished', () => {
    const groups = [
      { group: groupStageGroup, players: [] },
      { group: placementGroup, players: [] },
    ];
    const matches = [match('m1', 'group-a', 'CONFIRMADA')];

    const blockers = getEditionFinalizeBlockers(edition('FASE_COLOCACAO'), matches, groups);
    expect(blockers).toContain('Publique a fase de colocação antes de encerrar.');
  });

  it('blocks finalize when group matches are still pending', () => {
    const groups = [{ group: groupStageGroup, players: [] }];
    const matches = [match('m1', 'group-a', 'CONFIRMADA'), match('m2', 'group-a', 'AGENDADA')];

    expect(canFinalizeEdition(edition('EM_ANDAMENTO'), matches, groups)).toBe(false);
  });
});
