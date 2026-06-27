import type { RankingCriterion } from '@clandestino/shared-contracts';
import {
  COUNTED_MATCH_STATUSES,
  type PlayerMatchStats,
  type StandingMatch,
} from './types.js';

export function extractPlayersFromMatches(matches: StandingMatch[]): string[] {
  const ids = new Set<string>();
  for (const match of matches) {
    ids.add(match.playerA);
    ids.add(match.playerB);
  }
  return [...ids];
}

export function computePlayerStats(
  playerIds: string[],
  matches: StandingMatch[],
): Map<string, PlayerMatchStats> {
  const stats = new Map<string, PlayerMatchStats>();

  for (const playerId of playerIds) {
    stats.set(playerId, {
      playerId,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      matchesWon: 0,
      matchesPlayed: 0,
    });
  }

  for (const match of matches) {
    if (!COUNTED_MATCH_STATUSES.has(match.status)) {
      continue;
    }

    const playerA = stats.get(match.playerA);
    const playerB = stats.get(match.playerB);
    if (!playerA || !playerB) {
      continue;
    }

    playerA.setsWon += match.setsWonA;
    playerA.setsLost += match.setsWonB;
    playerA.matchesPlayed += 1;

    playerB.setsWon += match.setsWonB;
    playerB.setsLost += match.setsWonA;
    playerB.matchesPlayed += 1;

    if (match.setsWonA > match.setsWonB) {
      playerA.matchesWon += 1;
    } else if (match.setsWonB > match.setsWonA) {
      playerB.matchesWon += 1;
    }
  }

  for (const player of stats.values()) {
    player.setDiff = player.setsWon - player.setsLost;
  }

  return stats;
}

function headToHeadResult(
  playerA: string,
  playerB: string,
  matches: StandingMatch[],
): number {
  for (const match of matches) {
    if (!COUNTED_MATCH_STATUSES.has(match.status)) {
      continue;
    }

    const isPair =
      (match.playerA === playerA && match.playerB === playerB) ||
      (match.playerA === playerB && match.playerB === playerA);
    if (!isPair) {
      continue;
    }

    const setsForA = match.playerA === playerA ? match.setsWonA : match.setsWonB;
    const setsForB = match.playerA === playerA ? match.setsWonB : match.setsWonA;
    if (setsForA > setsForB) {
      return -1;
    }
    if (setsForB > setsForA) {
      return 1;
    }
    return 0;
  }

  return 0;
}

export function compareByCriteria(
  left: PlayerMatchStats,
  right: PlayerMatchStats,
  criteria: RankingCriterion[],
  matches: StandingMatch[],
): number {
  for (const criterion of criteria) {
    let comparison = 0;

    switch (criterion) {
      case 'SETS_WON':
        comparison = right.setsWon - left.setsWon;
        break;
      case 'SET_DIFF':
        comparison = right.setDiff - left.setDiff;
        break;
      case 'MATCHES_WON':
        comparison = right.matchesWon - left.matchesWon;
        break;
      case 'HEAD_TO_HEAD':
        comparison = headToHeadResult(left.playerId, right.playerId, matches);
        break;
      case 'POINTS_DIFF':
      case 'RANDOM_OR_ORGANIZER':
        comparison = 0;
        break;
    }

    if (comparison !== 0) {
      return comparison;
    }
  }

  return left.playerId.localeCompare(right.playerId);
}

export function resolveTies(
  players: string[],
  matches: StandingMatch[],
  criteria: RankingCriterion[],
): string[] {
  const stats = computePlayerStats(players, matches);
  return [...players].sort((leftId, rightId) =>
    compareByCriteria(
      stats.get(leftId)!,
      stats.get(rightId)!,
      criteria,
      matches,
    ),
  );
}
