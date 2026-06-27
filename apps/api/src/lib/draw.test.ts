import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import {
  buildGeneratedGroupMatches,
  executeDrawAlgorithm,
  rankEditionPlayers,
} from './draw.js';

function playerId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

describe('rankEditionPlayers', () => {
  it('orders players by accumulated points and marks protected seeds', () => {
    const ranked = rankEditionPlayers(
      [
        { playerId: playerId(1), playerName: 'Bruno' },
        { playerId: playerId(2), playerName: 'Ana' },
        { playerId: playerId(3), playerName: 'Carla' },
      ],
      new Map([
        [playerId(1), 80],
        [playerId(2), 120],
        [playerId(3), 120],
      ]),
      2,
    );

    expect(ranked.map((player) => player.playerId)).toEqual([
      playerId(2),
      playerId(3),
      playerId(1),
    ]);
    expect(ranked[0]?.isSeed).toBe(true);
    expect(ranked[1]?.isSeed).toBe(true);
    expect(ranked[2]?.isSeed).toBe(false);
  });
});

describe('executeDrawAlgorithm', () => {
  it('places exactly one seed in each group for 16 players and 4 groups', () => {
    const rules = {
      ...DEFAULT_TOURNAMENT_RULES,
      preferredGroupSize: 4,
      maximumGroupSize: 4,
      protectedSeedCount: 4,
    };
    const rankedPlayers = rankEditionPlayers(
      Array.from({ length: 16 }, (_, index) => ({
        playerId: playerId(index + 1),
        playerName: `Jogador ${index + 1}`,
      })),
      new Map(
        Array.from({ length: 16 }, (_, index) => [playerId(index + 1), 200 - index * 5]),
      ),
      rules.protectedSeedCount,
    );

    const draw = executeDrawAlgorithm({
      rankedPlayers,
      rules,
      randomSeed: 'acceptance-seed-16x4',
    });

    expect(draw.groupCount).toBe(4);
    expect(draw.groups).toHaveLength(4);

    for (const group of draw.groups) {
      expect(group.players.filter((player) => player.isSeed)).toHaveLength(1);
      expect(group.players).toHaveLength(4);
    }
  });

  it('produces the same groups when rerun with the same random seed', () => {
    const rules = {
      ...DEFAULT_TOURNAMENT_RULES,
      preferredGroupSize: 4,
      maximumGroupSize: 4,
      protectedSeedCount: 4,
    };
    const rankedPlayers = rankEditionPlayers(
      Array.from({ length: 16 }, (_, index) => ({
        playerId: playerId(index + 1),
        playerName: `Jogador ${index + 1}`,
      })),
      new Map(
        Array.from({ length: 16 }, (_, index) => [playerId(index + 1), 200 - index * 5]),
      ),
      rules.protectedSeedCount,
    );
    const input = {
      rankedPlayers,
      rules,
      randomSeed: 'reproducible-seed',
    };

    expect(executeDrawAlgorithm(input)).toEqual(executeDrawAlgorithm(input));
  });
});

describe('buildGeneratedGroupMatches', () => {
  it('creates round-robin pairings with ordered player ids', () => {
    const groups = [
      {
        index: 0,
        name: 'Grupo A',
        players: [
          { playerId: playerId(2), isSeed: true },
          { playerId: playerId(1), isSeed: false },
          { playerId: playerId(3), isSeed: false },
          { playerId: playerId(4), isSeed: false },
        ],
      },
    ];

    const matches = buildGeneratedGroupMatches(groups);

    expect(matches).toHaveLength(6);
    for (const match of matches) {
      expect(match.playerOneId < match.playerTwoId).toBe(true);
    }
  });
});
