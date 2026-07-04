import { allocateSeededPlayers } from './allocate-seeded-players.js';
import { drawUnseededPlayers } from './draw-unseeded-players.js';
import type { DrawGroupInput } from './types.js';

export interface ExplicitDrawGroupResult {
  index: number;
  name: string;
  players: Array<{ playerId: string; isSeed: boolean }>;
}

export interface ExplicitDrawResult {
  groupCount: number;
  groups: ExplicitDrawGroupResult[];
}

export function buildGroupName(index: number): string {
  return `Grupo ${String.fromCharCode(65 + index)}`;
}

function canonicalPlayerOrder(playerIds: readonly string[]): string[] {
  return [...playerIds].sort((left, right) => left.localeCompare(right));
}

export function executeExplicitDraw(input: {
  playerIds: readonly string[];
  seedPlayerIds: readonly string[];
  groupSizes: readonly number[];
  randomSeed: string;
}): ExplicitDrawResult {
  const { seedPlayerIds, groupSizes, randomSeed } = input;
  const playerIds = canonicalPlayerOrder(input.playerIds);
  const groupCount = groupSizes.length;

  if (groupCount < 1) {
    throw new Error('At least one group is required');
  }

  if (seedPlayerIds.length !== groupCount) {
    throw new Error(`Expected ${groupCount} seeds, got ${seedPlayerIds.length}`);
  }

  if (groupSizes.reduce((sum, size) => sum + size, 0) !== playerIds.length) {
    throw new Error('Group sizes do not match player count');
  }

  const uniquePlayers = new Set(playerIds);
  if (uniquePlayers.size !== playerIds.length) {
    throw new Error('Duplicate player ids are not allowed');
  }

  for (const seedPlayerId of seedPlayerIds) {
    if (!uniquePlayers.has(seedPlayerId)) {
      throw new Error(`Seed player ${seedPlayerId} is not in the player list`);
    }
  }

  const seedSet = new Set(seedPlayerIds);
  const unseeded = playerIds.filter((playerId) => !seedSet.has(playerId));
  const seedAssignments = allocateSeededPlayers([...seedPlayerIds], groupCount);
  const groups: DrawGroupInput[] = groupSizes.map((targetSize, index) => ({
    index,
    players: [],
    targetSize,
  }));

  for (const assignment of seedAssignments) {
    groups[assignment.groupIndex]!.players.push({
      playerId: assignment.playerId,
      isSeed: true,
    });
  }

  const drawnGroups = drawUnseededPlayers(unseeded, groups, randomSeed);

  return {
    groupCount,
    groups: drawnGroups.map((group) => ({
      index: group.index,
      name: buildGroupName(group.index),
      players: group.players,
    })),
  };
}
