import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  allocateSeededPlayers,
  calculateFinalStanding,
  calculateGroupStanding,
  chooseGroupConfiguration,
  drawUnseededPlayers,
  generateGroupMatches,
  generatePlacementStage,
  MAX_SETS_SCORE,
  resolveTies,
  validateMatchResult,
} from './index.js';
import type { DrawGroupInput, PlacementGroupResult, StandingMatch } from './types.js';

const rules = DEFAULT_TOURNAMENT_RULES;

function playerId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function validPlayerCounts(rules = DEFAULT_TOURNAMENT_RULES): number[] {
  const counts: number[] = [];
  for (let playerCount = rules.minimumGroupSize; playerCount <= 40; playerCount++) {
    try {
      chooseGroupConfiguration(playerCount, rules);
      counts.push(playerCount);
    } catch {
      // Some counts cannot be partitioned with the configured group size limits.
    }
  }
  return counts;
}

describe('chooseGroupConfiguration', () => {
  it('partitions players into valid group sizes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...validPlayerCounts()), (playerCount) => {
        const config = chooseGroupConfiguration(playerCount, rules);
        expect(config.groupSizes.reduce((sum, size) => sum + size, 0)).toBe(playerCount);
        expect(config.groupCount).toBe(config.groupSizes.length);
        for (const size of config.groupSizes) {
          expect(size).toBeGreaterThanOrEqual(rules.minimumGroupSize);
          expect(size).toBeLessThanOrEqual(rules.maximumGroupSize);
        }
      }),
    );
  });

  it('prefers groups near preferred size for 15 participants', () => {
    const config = chooseGroupConfiguration(15, rules);
    expect(config.groupCount).toBe(4);
    expect(config.groupSizes).toEqual([4, 4, 4, 3]);
  });
});

describe('allocateSeededPlayers', () => {
  it('places at most one seed per group when seed count equals group count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (groupCount) => {
        const seeds = Array.from({ length: groupCount }, (_, i) => playerId(i + 1));
        const assignments = allocateSeededPlayers(seeds, groupCount);
        const seedsPerGroup = new Map<number, number>();

        for (const assignment of assignments) {
          seedsPerGroup.set(
            assignment.groupIndex,
            (seedsPerGroup.get(assignment.groupIndex) ?? 0) + 1,
          );
        }

        for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
          expect(seedsPerGroup.get(groupIndex)).toBe(1);
        }
      }),
    );
  });

  it('uses snake order for extra protected seeds', () => {
    const assignments = allocateSeededPlayers(
      [playerId(1), playerId(2), playerId(3), playerId(4), playerId(5), playerId(6)],
      3,
    );
    expect(assignments.map((a) => a.groupIndex)).toEqual([0, 1, 2, 2, 1, 0]);
  });
});

describe('drawUnseededPlayers', () => {
  it('produces identical draws for the same seed', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 4, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 32 }),
        (unseeded, seed) => {
          const groups: DrawGroupInput[] = [
            { index: 0, players: [{ playerId: playerId(1), isSeed: true }], targetSize: 5 },
            { index: 1, players: [{ playerId: playerId(2), isSeed: true }], targetSize: 5 },
            { index: 2, players: [{ playerId: playerId(3), isSeed: true }], targetSize: 5 },
          ];

          const first = drawUnseededPlayers(unseeded, groups, seed);
          const second = drawUnseededPlayers(unseeded, groups, seed);
          expect(first).toEqual(second);
        },
      ),
    );
  });

  it('places every unseeded player exactly once', () => {
    const unseeded = [playerId(10), playerId(11), playerId(12), playerId(13)];
    const groups: DrawGroupInput[] = [
      { index: 0, players: [{ playerId: playerId(1), isSeed: true }], targetSize: 3 },
      { index: 1, players: [{ playerId: playerId(2), isSeed: true }], targetSize: 3 },
    ];
    const drawn = drawUnseededPlayers(unseeded, groups, 'test-seed');
    const placed = drawn.flatMap((group) => group.players.map((p) => p.playerId));
    expect(placed.sort()).toEqual([...unseeded, playerId(1), playerId(2)].sort());
  });
});

describe('generateGroupMatches', () => {
  it('creates round-robin pairings', () => {
    const matches = generateGroupMatches({
      playerIds: [playerId(1), playerId(2), playerId(3), playerId(4)],
    });
    expect(matches).toHaveLength(6);
  });
});

describe('validateMatchResult', () => {
  it('accepts legal best-of-3 and best-of-5 terminal scores', () => {
    expect(validateMatchResult({ setsWonByReporter: 2, setsWonByOpponent: 0 }, 3).valid).toBe(true);
    expect(validateMatchResult({ setsWonByReporter: 2, setsWonByOpponent: 1 }, 3).valid).toBe(true);
    expect(validateMatchResult({ setsWonByReporter: 3, setsWonByOpponent: 0 }, 5).valid).toBe(true);
    expect(validateMatchResult({ setsWonByReporter: 3, setsWonByOpponent: 2 }, 5).valid).toBe(true);
  });

  it('rejects scores impossible for the match format', () => {
    expect(validateMatchResult({ setsWonByReporter: 4, setsWonByOpponent: 2 }, 5).valid).toBe(
      false,
    );
    expect(validateMatchResult({ setsWonByReporter: 0, setsWonByOpponent: 7 }, 5).valid).toBe(
      false,
    );
    expect(validateMatchResult({ setsWonByReporter: 3, setsWonByOpponent: 2 }, 3).valid).toBe(
      false,
    );
    expect(validateMatchResult({ setsWonByReporter: 1, setsWonByOpponent: 0 }, 3).valid).toBe(
      false,
    );
    expect(validateMatchResult({ setsWonByReporter: 2, setsWonByOpponent: 2 }, 3).valid).toBe(
      false,
    );
    expect(validateMatchResult({ setsWonByReporter: -1, setsWonByOpponent: 3 }, 5).valid).toBe(
      false,
    );
    expect(
      validateMatchResult(
        {
          setsWonByReporter: MAX_SETS_SCORE + 1,
          setsWonByOpponent: 3,
        },
        5,
      ).valid,
    ).toBe(false);
  });

  it('accepts only terminal scores for a given best-of', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(3, 5),
        fc.integer({ min: 0, max: MAX_SETS_SCORE }),
        fc.integer({ min: 0, max: MAX_SETS_SCORE }),
        (bestOf, a, b) => {
          const result = validateMatchResult(
            { setsWonByReporter: a, setsWonByOpponent: b },
            bestOf as 3 | 5,
          );
          const required = Math.ceil(bestOf / 2);
          const winner = Math.max(a, b);
          const loser = Math.min(a, b);
          const expected =
            a !== b &&
            a >= 0 &&
            b >= 0 &&
            a <= MAX_SETS_SCORE &&
            b <= MAX_SETS_SCORE &&
            winner === required &&
            loser < required;
          expect(result.valid).toBe(expected);
        },
      ),
    );
  });
});

describe('resolveTies', () => {
  const matches: StandingMatch[] = [
    {
      playerA: playerId(1),
      playerB: playerId(2),
      setsWonA: 2,
      setsWonB: 0,
      status: 'CONFIRMADA',
    },
    {
      playerA: playerId(1),
      playerB: playerId(3),
      setsWonA: 2,
      setsWonB: 1,
      status: 'CONFIRMADA',
    },
    {
      playerA: playerId(2),
      playerB: playerId(3),
      setsWonA: 2,
      setsWonB: 1,
      status: 'CONFIRMADA',
    },
  ];

  it('orders by sets won, then set diff, then matches won', () => {
    const ordered = resolveTies([playerId(1), playerId(2), playerId(3)], matches, [
      'SETS_WON',
      'SET_DIFF',
      'MATCHES_WON',
    ]);
    expect(ordered[0]).toBe(playerId(1));
    expect(ordered[1]).toBe(playerId(2));
    expect(ordered[2]).toBe(playerId(3));
  });

  it('uses head-to-head when configured', () => {
    const tiedMatches: StandingMatch[] = [
      {
        playerA: playerId(1),
        playerB: playerId(2),
        setsWonA: 2,
        setsWonB: 1,
        status: 'CONFIRMADA',
      },
      {
        playerA: playerId(1),
        playerB: playerId(3),
        setsWonA: 0,
        setsWonB: 2,
        status: 'CONFIRMADA',
      },
      {
        playerA: playerId(2),
        playerB: playerId(3),
        setsWonA: 2,
        setsWonB: 0,
        status: 'CONFIRMADA',
      },
    ];

    const ordered = resolveTies([playerId(1), playerId(2), playerId(3)], tiedMatches, [
      'SETS_WON',
      'HEAD_TO_HEAD',
      'SET_DIFF',
      'MATCHES_WON',
    ]);
    expect(ordered[0]).toBe(playerId(2));
  });
});

describe('calculateGroupStanding', () => {
  it('is deterministic for the same input', () => {
    const matches: StandingMatch[] = [
      {
        playerA: playerId(1),
        playerB: playerId(2),
        setsWonA: 2,
        setsWonB: 0,
        status: 'CONFIRMADA',
      },
      {
        playerA: playerId(1),
        playerB: playerId(3),
        setsWonA: 2,
        setsWonB: 1,
        status: 'CONFIRMADA',
      },
      {
        playerA: playerId(2),
        playerB: playerId(3),
        setsWonA: 2,
        setsWonB: 1,
        status: 'CONFIRMADA',
      },
    ];

    const first = calculateGroupStanding(matches, rules);
    const second = calculateGroupStanding(matches, rules);
    expect(first).toEqual(second);
  });
});

describe('generatePlacementStage', () => {
  it('creates round-robin for 3+ players and knockout for 2', () => {
    const threeWayStage = generatePlacementStage(
      [
        {
          groupId: 'a',
          standings: [
            { playerId: playerId(1), setsWon: 6, setDiff: 4, matchesWon: 3, rankInGroup: 1 },
            { playerId: playerId(4), setsWon: 3, setDiff: 0, matchesWon: 1, rankInGroup: 2 },
          ],
        },
        {
          groupId: 'b',
          standings: [
            { playerId: playerId(2), setsWon: 6, setDiff: 3, matchesWon: 3, rankInGroup: 1 },
            { playerId: playerId(5), setsWon: 4, setDiff: 1, matchesWon: 2, rankInGroup: 2 },
          ],
        },
        {
          groupId: 'c',
          standings: [
            { playerId: playerId(3), setsWon: 5, setDiff: 2, matchesWon: 2, rankInGroup: 1 },
            { playerId: playerId(6), setsWon: 2, setDiff: -2, matchesWon: 1, rankInGroup: 2 },
          ],
        },
      ],
      rules,
    );

    expect(threeWayStage).toHaveLength(2);
    expect(threeWayStage[0]!.format).toBe('round-robin');
    expect(threeWayStage[1]!.format).toBe('round-robin');

    const knockoutStage = generatePlacementStage(
      [
        {
          groupId: 'a',
          standings: [
            { playerId: playerId(1), setsWon: 6, setDiff: 4, matchesWon: 3, rankInGroup: 1 },
            { playerId: playerId(3), setsWon: 3, setDiff: 0, matchesWon: 1, rankInGroup: 2 },
          ],
        },
        {
          groupId: 'b',
          standings: [
            { playerId: playerId(2), setsWon: 6, setDiff: 3, matchesWon: 3, rankInGroup: 1 },
            { playerId: playerId(4), setsWon: 4, setDiff: 1, matchesWon: 2, rankInGroup: 2 },
          ],
        },
      ],
      rules,
    );

    expect(knockoutStage).toHaveLength(2);
    expect(knockoutStage[0]!.format).toBe('knockout');
    expect(knockoutStage[0]!.name).toBe('Colocação 1º-2º');
    expect(knockoutStage[0]!.playerIds).toEqual([playerId(1), playerId(2)]);
    expect(knockoutStage[0]!.positionRange).toEqual({ from: 1, to: 2 });
    expect(knockoutStage[1]!.format).toBe('knockout');
    expect(knockoutStage[1]!.name).toBe('Colocação 3º-4º');
    expect(knockoutStage[1]!.playerIds).toEqual([playerId(3), playerId(4)]);
    expect(knockoutStage[1]!.positionRange).toEqual({ from: 3, to: 4 });
  });
});

describe('calculateFinalStanding', () => {
  it('maps placement results to final positions', () => {
    const results: PlacementGroupResult[] = [
      {
        positionRange: { from: 1, to: 3 },
        format: 'round-robin',
        orderedPlayerIds: [playerId(1), playerId(2), playerId(3)],
      },
      {
        positionRange: { from: 4, to: 5 },
        format: 'knockout',
        winnerId: playerId(4),
        loserId: playerId(5),
      },
      {
        positionRange: { from: 6, to: 6 },
        format: 'round-robin',
        directPlayerId: playerId(6),
      },
    ];

    expect(calculateFinalStanding(results)).toEqual([
      { playerId: playerId(1), position: 1 },
      { playerId: playerId(2), position: 2 },
      { playerId: playerId(3), position: 3 },
      { playerId: playerId(4), position: 4 },
      { playerId: playerId(5), position: 5 },
      { playerId: playerId(6), position: 6 },
    ]);
  });
});
