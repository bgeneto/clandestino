import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import {
  attachScoringPoints,
  calculateGroupStanding,
  generatePlacementStage,
  validateMatchResult,
} from '@clandestino/tournament-engine';
import { describe, expect, it } from 'vitest';
import {
  mapSetsToParticipants,
  parsePlacementGroupRange,
  validateCorrectedScore,
  validateSubmittedScore,
} from './matches.js';

function playerId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

describe('validateSubmittedScore', () => {
  it('rejects a tied score', () => {
    const result = validateSubmittedScore(2, 2);
    expect(result.valid).toBe(false);
  });

  it('accepts a valid score', () => {
    const result = validateSubmittedScore(4, 2);
    expect(result.valid).toBe(true);
  });
});

describe('validateMatchResult', () => {
  it('rejects tied scores', () => {
    const result = validateMatchResult({
      setsWonByReporter: 2,
      setsWonByOpponent: 2,
    });
    expect(result.valid).toBe(false);
  });
});

describe('mapSetsToParticipants', () => {
  it('maps reporter scores to ordered participants', () => {
    const one = playerId(1);
    const two = playerId(2);

    expect(mapSetsToParticipants(one, one, two, 2, 1)).toEqual({
      playerOneSets: 2,
      playerTwoSets: 1,
    });

    expect(mapSetsToParticipants(two, one, two, 2, 0)).toEqual({
      playerOneSets: 0,
      playerTwoSets: 2,
    });
  });
});

describe('calculateGroupStanding tiebreakers', () => {
  it('orders players by sets won, set diff, then matches won', () => {
    const matches = [
      {
        playerA: playerId(1),
        playerB: playerId(2),
        setsWonA: 2,
        setsWonB: 1,
        status: 'CONFIRMADA' as const,
      },
      {
        playerA: playerId(1),
        playerB: playerId(3),
        setsWonA: 2,
        setsWonB: 0,
        status: 'CONFIRMADA' as const,
      },
      {
        playerA: playerId(2),
        playerB: playerId(3),
        setsWonA: 2,
        setsWonB: 1,
        status: 'CONFIRMADA' as const,
      },
    ];

    const standing = calculateGroupStanding(matches, DEFAULT_TOURNAMENT_RULES);
    expect(standing.map((entry) => entry.playerId)).toEqual([
      playerId(1),
      playerId(2),
      playerId(3),
    ]);
    expect(standing[0]).toMatchObject({ setsWon: 4, setDiff: 3, matchesWon: 2 });
    expect(standing[1]).toMatchObject({ setsWon: 3, setDiff: 0, matchesWon: 1 });
  });
});

describe('generatePlacementStage', () => {
  it('creates round-robin placement for 3+ players and knockout for 2', () => {
    const threeGroupStandings = [
      {
        groupId: 'group-a',
        standings: [
          { playerId: playerId(1), setsWon: 6, setDiff: 4, matchesWon: 3, rankInGroup: 1 },
          { playerId: playerId(4), setsWon: 3, setDiff: 0, matchesWon: 1, rankInGroup: 2 },
        ],
      },
      {
        groupId: 'group-b',
        standings: [
          { playerId: playerId(2), setsWon: 6, setDiff: 3, matchesWon: 3, rankInGroup: 1 },
          { playerId: playerId(5), setsWon: 4, setDiff: 1, matchesWon: 2, rankInGroup: 2 },
        ],
      },
      {
        groupId: 'group-c',
        standings: [
          { playerId: playerId(3), setsWon: 5, setDiff: 2, matchesWon: 2, rankInGroup: 1 },
          { playerId: playerId(6), setsWon: 2, setDiff: -2, matchesWon: 1, rankInGroup: 2 },
        ],
      },
    ];

    const placementStage = generatePlacementStage(threeGroupStandings, DEFAULT_TOURNAMENT_RULES);
    const firstPlaces = placementStage.find((group) => group.positionRange.from === 1);
    const secondPlaces = placementStage.find((group) => group.positionRange.from === 4);

    expect(firstPlaces?.format).toBe('round-robin');
    expect(firstPlaces?.playerIds).toHaveLength(3);
    expect(secondPlaces?.format).toBe('round-robin');
    expect(secondPlaces?.playerIds).toHaveLength(3);

    const twoGroupStandings = [
      {
        groupId: 'group-a',
        standings: [
          { playerId: playerId(1), setsWon: 6, setDiff: 4, matchesWon: 3, rankInGroup: 1 },
          { playerId: playerId(3), setsWon: 3, setDiff: 0, matchesWon: 1, rankInGroup: 2 },
        ],
      },
      {
        groupId: 'group-b',
        standings: [
          { playerId: playerId(2), setsWon: 6, setDiff: 3, matchesWon: 3, rankInGroup: 1 },
          { playerId: playerId(4), setsWon: 4, setDiff: 1, matchesWon: 2, rankInGroup: 2 },
        ],
      },
    ];

    const knockoutStage = generatePlacementStage(twoGroupStandings, DEFAULT_TOURNAMENT_RULES);
    expect(knockoutStage.find((group) => group.positionRange.from === 1)?.format).toBe('knockout');
    expect(knockoutStage.find((group) => group.positionRange.from === 3)?.format).toBe('knockout');
  });
});

describe('attachScoringPoints', () => {
  it('awards zero points for positions beyond the scoring table', () => {
    const standings = attachScoringPoints(
      [
        { playerId: playerId(1), position: 1 },
        { playerId: playerId(2), position: 21 },
      ],
      [
        { position: 1, points: 200 },
        { position: 20, points: 1 },
      ],
    );

    expect(standings[0]?.pointsAwarded).toBe(200);
    expect(standings[1]?.pointsAwarded).toBe(0);
  });
});

describe('parsePlacementGroupRange', () => {
  it('parses placement group names', () => {
    expect(parsePlacementGroupRange('Colocação 1º-3º')).toEqual({ from: 1, to: 3 });
    expect(parsePlacementGroupRange('Grupo A')).toBeNull();
  });
});

describe('validateCorrectedScore', () => {
  it('rejects invalid organizer corrections', () => {
    const result = validateCorrectedScore(2, 2);
    expect(result.valid).toBe(false);
  });
});
