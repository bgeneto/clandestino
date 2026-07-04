import type { TournamentRules } from '@clandestino/shared-contracts';
import type { GroupStandingInput, PlacementStageGroup } from './types.js';
import { choosePlacementFormat } from './adapt-placement-band.js';

export function generatePlacementStage(
  groupStandings: GroupStandingInput[],
  _rules: TournamentRules,
): PlacementStageGroup[] {
  if (groupStandings.length === 0) {
    return [];
  }

  const groupCount = groupStandings.length;
  const maxRank = Math.max(
    ...groupStandings.flatMap((group) => group.standings.map((entry) => entry.rankInGroup)),
  );

  const placementGroups: PlacementStageGroup[] = [];

  for (let rank = 1; rank <= maxRank; rank++) {
    const playersAtRank: string[] = [];
    for (const group of groupStandings) {
      const entry = group.standings.find((standing) => standing.rankInGroup === rank);
      if (entry) {
        playersAtRank.push(entry.playerId);
      }
    }

    if (playersAtRank.length <= 1) {
      continue;
    }

    const format = choosePlacementFormat(playersAtRank.length);
    const positionFrom = (rank - 1) * groupCount + 1;
    const positionTo = positionFrom + playersAtRank.length - 1;

    placementGroups.push({
      name: `Colocação ${positionFrom}º-${positionTo}º`,
      format,
      playerIds: playersAtRank,
      positionRange: { from: positionFrom, to: positionTo },
    });
  }

  return placementGroups;
}

/** Builds direct-placement results for ranks with a single player (no matches). */
export function directPlacementsFromStandings(
  groupStandings: GroupStandingInput[],
): Array<{ playerId: string; position: number }> {
  const groupCount = groupStandings.length;
  const maxRank = Math.max(
    ...groupStandings.flatMap((group) => group.standings.map((entry) => entry.rankInGroup)),
  );

  const direct: Array<{ playerId: string; position: number }> = [];

  for (let rank = 1; rank <= maxRank; rank++) {
    const playersAtRank: string[] = [];
    for (const group of groupStandings) {
      const entry = group.standings.find((standing) => standing.rankInGroup === rank);
      if (entry) {
        playersAtRank.push(entry.playerId);
      }
    }

    if (playersAtRank.length === 1) {
      direct.push({
        playerId: playersAtRank[0]!,
        position: (rank - 1) * groupCount + 1,
      });
    }
  }

  return direct;
}
