import type { TournamentRules } from '@clandestino/shared-contracts';
import { computePlayerStats, extractPlayersFromMatches, resolveTies } from './player-stats.js';
import type { GroupStandingEntry, StandingMatch } from './types.js';

export function calculateGroupStanding(
  matches: StandingMatch[],
  rules: TournamentRules,
): GroupStandingEntry[] {
  const playerIds = extractPlayersFromMatches(matches);
  const ordered = resolveTies(playerIds, matches, rules.groupRankingCriteria);
  const stats = computePlayerStats(playerIds, matches);

  return ordered.map((playerId, index) => {
    const playerStats = stats.get(playerId)!;
    return {
      playerId,
      setsWon: playerStats.setsWon,
      setDiff: playerStats.setDiff,
      matchesWon: playerStats.matchesWon,
      rankInGroup: index + 1,
    };
  });
}
