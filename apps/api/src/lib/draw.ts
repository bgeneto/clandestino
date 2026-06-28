import type { TournamentRules } from '@clandestino/shared-contracts';
import {
  allocateSeededPlayers,
  chooseGroupConfiguration,
  drawUnseededPlayers,
  executeExplicitDraw,
  generateGroupMatches,
  getMatchBestOf,
} from '@clandestino/tournament-engine';
import type { DrawGroupInput } from '@clandestino/tournament-engine';

export const DRAW_ALGORITHM = 'seeded-balanced-v1';
export const GROUP_PHASE = 'GROUP_STAGE';

export interface RankedEditionPlayer {
  playerId: string;
  accumulatedPoints: number;
  rankPosition: number;
  isSeed: boolean;
}

export interface DrawGroupResult {
  index: number;
  name: string;
  players: Array<{ playerId: string; isSeed: boolean }>;
}

export interface DrawAlgorithmResult {
  groupCount: number;
  groups: DrawGroupResult[];
}

export interface GeneratedGroupMatch {
  groupIndex: number;
  playerOneId: string;
  playerTwoId: string;
}

export function buildGroupName(index: number): string {
  return `Grupo ${String.fromCharCode(65 + index)}`;
}

export function rankEditionPlayers(
  registrations: Array<{ playerId: string; playerName: string }>,
  pointsByPlayerId: ReadonlyMap<string, number>,
  protectedSeedCount: number,
): RankedEditionPlayer[] {
  const sorted = [...registrations].sort((left, right) => {
    const leftPoints = pointsByPlayerId.get(left.playerId) ?? 0;
    const rightPoints = pointsByPlayerId.get(right.playerId) ?? 0;

    if (rightPoints !== leftPoints) {
      return rightPoints - leftPoints;
    }

    return left.playerName.localeCompare(right.playerName, 'pt-BR');
  });

  return sorted.map((registration, index) => ({
    playerId: registration.playerId,
    accumulatedPoints: pointsByPlayerId.get(registration.playerId) ?? 0,
    rankPosition: index + 1,
    isSeed: index < protectedSeedCount,
  }));
}

export function rankEditionPlayersWithSeeds(
  registrations: Array<{ playerId: string; playerName: string }>,
  pointsByPlayerId: ReadonlyMap<string, number>,
  seedPlayerIds: readonly string[],
): RankedEditionPlayer[] {
  const seedSet = new Set(seedPlayerIds);
  const ranked = rankEditionPlayers(registrations, pointsByPlayerId, 0);

  return ranked.map((player) => ({
    ...player,
    isSeed: seedSet.has(player.playerId),
  }));
}

export function executeDrawAlgorithm(input: {
  rankedPlayers: RankedEditionPlayer[];
  rules: TournamentRules;
  randomSeed: string;
}): DrawAlgorithmResult {
  const { rankedPlayers, rules, randomSeed } = input;
  const config = chooseGroupConfiguration(rankedPlayers.length, rules);
  const seeds = rankedPlayers.filter((player) => player.isSeed).map((player) => player.playerId);
  const unseeded = rankedPlayers
    .filter((player) => !player.isSeed)
    .map((player) => player.playerId);
  const seedAssignments = allocateSeededPlayers(seeds, config.groupCount);
  const groups: DrawGroupInput[] = config.groupSizes.map((targetSize, index) => ({
    index,
    targetSize,
    players: [],
  }));

  for (const assignment of seedAssignments) {
    groups[assignment.groupIndex]!.players.push({
      playerId: assignment.playerId,
      isSeed: true,
    });
  }

  const drawnGroups = drawUnseededPlayers(unseeded, groups, randomSeed);

  return {
    groupCount: config.groupCount,
    groups: drawnGroups.map((group) => ({
      index: group.index,
      name: buildGroupName(group.index),
      players: group.players,
    })),
  };
}

export function executeExplicitDrawAlgorithm(input: {
  playerIds: readonly string[];
  seedPlayerIds: readonly string[];
  groupSizes: readonly number[];
  randomSeed: string;
}): DrawAlgorithmResult {
  return executeExplicitDraw(input);
}

export function buildGeneratedGroupMatches(groups: DrawGroupResult[]): GeneratedGroupMatch[] {
  return groups.flatMap((group) =>
    generateGroupMatches({
      playerIds: group.players.map((player) => player.playerId),
    }).map((match) => ({
      groupIndex: group.index,
      playerOneId: match.playerA < match.playerB ? match.playerA : match.playerB,
      playerTwoId: match.playerA < match.playerB ? match.playerB : match.playerA,
    })),
  );
}

export function resolveMatchBestOf(participantCount: number, rules: TournamentRules): 3 | 5 {
  return getMatchBestOf(participantCount, rules);
}
