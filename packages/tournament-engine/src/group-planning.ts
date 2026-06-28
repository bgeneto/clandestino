import type { GroupConfiguration } from './types.js';

/** Minimum players per group in the organizer wizard flow. */
export const WIZARD_MIN_GROUP_SIZE = 3;

/** Maximum recommended players per group before showing a warning in the wizard. */
export const WIZARD_WARN_GROUP_SIZE = 6;

/** Total round-robin matches above which melhor de 3 is recommended. */
export const WIZARD_BEST_OF_THREE_MATCH_THRESHOLD = 30;

export function maxGroupCount(
  playerCount: number,
  minimumGroupSize = WIZARD_MIN_GROUP_SIZE,
): number {
  if (playerCount < minimumGroupSize) {
    return 0;
  }

  return Math.floor(playerCount / minimumGroupSize);
}

/** Partitions players into `groupCount` groups as evenly as possible. */
export function partitionPlayersIntoGroups(
  playerCount: number,
  groupCount: number,
  minimumGroupSize = WIZARD_MIN_GROUP_SIZE,
): number[] {
  if (groupCount < 1) {
    throw new Error('groupCount must be at least 1');
  }

  if (playerCount < groupCount * minimumGroupSize) {
    throw new Error(
      `Cannot partition ${playerCount} players into ${groupCount} groups with minimum ${minimumGroupSize} per group`,
    );
  }

  const base = Math.floor(playerCount / groupCount);
  const remainder = playerCount % groupCount;
  const groupSizes: number[] = [];

  for (let index = 0; index < groupCount; index++) {
    groupSizes.push(index < remainder ? base + 1 : base);
  }

  if (groupSizes.some((size) => size < minimumGroupSize)) {
    throw new Error(`Invalid partition for ${playerCount} players into ${groupCount} groups`);
  }

  return groupSizes;
}

export function estimateRoundRobinMatches(groupSizes: readonly number[]): number {
  return groupSizes.reduce((total, size) => total + (size * (size - 1)) / 2, 0);
}

export function buildGroupConfiguration(
  playerCount: number,
  groupCount: number,
  minimumGroupSize = WIZARD_MIN_GROUP_SIZE,
): GroupConfiguration {
  return {
    groupCount,
    groupSizes: partitionPlayersIntoGroups(playerCount, groupCount, minimumGroupSize),
  };
}

/** Suggests a conservative group count minimizing large groups and total matches. */
export function suggestGroupCount(
  playerCount: number,
  minimumGroupSize = WIZARD_MIN_GROUP_SIZE,
): number {
  const upperBound = maxGroupCount(playerCount, minimumGroupSize);
  if (upperBound < 1) {
    throw new Error(`At least ${minimumGroupSize} players are required`);
  }

  let bestGroupCount = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let groupCount = 1; groupCount <= upperBound; groupCount++) {
    try {
      const groupSizes = partitionPlayersIntoGroups(playerCount, groupCount, minimumGroupSize);
      const totalMatches = estimateRoundRobinMatches(groupSizes);
      const largestGroup = Math.max(...groupSizes);
      const score = totalMatches + largestGroup * 3;

      if (score < bestScore) {
        bestScore = score;
        bestGroupCount = groupCount;
      }
    } catch {
      // skip invalid partitions
    }
  }

  return bestGroupCount;
}

export function recommendMatchBestOf(totalMatches: number): 3 | 5 {
  return totalMatches > WIZARD_BEST_OF_THREE_MATCH_THRESHOLD ? 3 : 5;
}

export interface SeedCandidate {
  playerId: string;
  playerName: string;
  accumulatedPoints: number;
}

/** Selects top-ranked players as default seeds (points desc, then name asc). */
export function selectDefaultSeeds(candidates: readonly SeedCandidate[], count: number): string[] {
  if (count < 0) {
    throw new Error('count must be non-negative');
  }

  const sorted = [...candidates].sort((left, right) => {
    if (right.accumulatedPoints !== left.accumulatedPoints) {
      return right.accumulatedPoints - left.accumulatedPoints;
    }

    return left.playerName.localeCompare(right.playerName, 'pt-BR');
  });

  return sorted.slice(0, count).map((candidate) => candidate.playerId);
}
