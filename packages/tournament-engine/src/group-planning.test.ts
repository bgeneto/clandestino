import { describe, expect, it } from 'vitest';
import {
  WIZARD_MIN_GROUP_SIZE,
  buildGroupConfiguration,
  estimateRoundRobinMatches,
  executeExplicitDraw,
  maxGroupCount,
  partitionPlayersIntoGroups,
  selectDefaultSeeds,
  suggestGroupCount,
} from './index.js';

function playerId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

describe('group planning helpers', () => {
  it('partitions 13 players into 3 groups as 5/4/4', () => {
    expect(partitionPlayersIntoGroups(13, 3)).toEqual([5, 4, 4]);
  });

  it('suggests multiple groups for 13 players', () => {
    expect(suggestGroupCount(13)).toBeGreaterThanOrEqual(2);
  });

  it('limits max groups by minimum group size', () => {
    expect(maxGroupCount(6, WIZARD_MIN_GROUP_SIZE)).toBe(2);
    expect(maxGroupCount(13, WIZARD_MIN_GROUP_SIZE)).toBe(4);
  });

  it('estimates round-robin matches', () => {
    expect(estimateRoundRobinMatches([4, 3])).toBe(9);
  });

  it('selects default seeds by points then name', () => {
    const seeds = selectDefaultSeeds(
      [
        { playerId: playerId(1), playerName: 'Bruno', accumulatedPoints: 10 },
        { playerId: playerId(2), playerName: 'Ana', accumulatedPoints: 20 },
        { playerId: playerId(3), playerName: 'Carla', accumulatedPoints: 15 },
      ],
      2,
    );

    expect(seeds).toEqual([playerId(2), playerId(3)]);
  });

  it('builds group configuration for wizard step', () => {
    expect(buildGroupConfiguration(6, 2)).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
    });
  });
});

describe('executeExplicitDraw', () => {
  it('places one seed per group and fills remaining players', () => {
    const playerIds = [
      playerId(1),
      playerId(2),
      playerId(3),
      playerId(4),
      playerId(5),
      playerId(6),
    ];
    const result = executeExplicitDraw({
      playerIds,
      seedPlayerIds: [playerId(1), playerId(2)],
      groupSizes: [3, 3],
      randomSeed: 'fixed-seed',
    });

    expect(result.groupCount).toBe(2);
    expect(result.groups[0]?.name).toBe('Grupo A');
    expect(result.groups[0]?.players).toHaveLength(3);
    expect(result.groups[1]?.players).toHaveLength(3);
    expect(
      result.groups.flatMap((group) => group.players).filter((player) => player.isSeed),
    ).toHaveLength(2);
  });

  it('is deterministic for the same random seed', () => {
    const input = {
      playerIds: [playerId(1), playerId(2), playerId(3), playerId(4), playerId(5), playerId(6)],
      seedPlayerIds: [playerId(1), playerId(2)],
      groupSizes: [3, 3] as const,
      randomSeed: 'repeatable-seed',
    };

    const first = executeExplicitDraw(input);
    const second = executeExplicitDraw(input);
    expect(first).toEqual(second);
  });
});
