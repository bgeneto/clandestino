import type { ScoringTable } from '@clandestino/shared-contracts';
import type { FinalStandingEntry, PlacementGroupResult } from './types.js';

export function pointsForPosition(position: number, scoringTable: ScoringTable): number {
  const entry = scoringTable.find((row) => row.position === position);
  return entry?.points ?? 0;
}

export function calculateFinalStanding(
  placementResults: PlacementGroupResult[],
): FinalStandingEntry[] {
  const standings: FinalStandingEntry[] = [];

  for (const group of placementResults) {
    const { from, to } = group.positionRange;

    if (group.directPlayerId) {
      standings.push({ playerId: group.directPlayerId, position: from });
      continue;
    }

    if (group.format === 'knockout') {
      if (group.winnerId) {
        standings.push({ playerId: group.winnerId, position: from });
      }
      if (group.loserId) {
        standings.push({ playerId: group.loserId, position: to });
      }
      continue;
    }

    if (group.orderedPlayerIds) {
      for (const [index, playerId] of group.orderedPlayerIds.entries()) {
        standings.push({ playerId, position: from + index });
      }
    }
  }

  return standings.sort((left, right) => left.position - right.position);
}

export function attachScoringPoints(
  standings: FinalStandingEntry[],
  scoringTable: ScoringTable,
): Array<FinalStandingEntry & { pointsAwarded: number }> {
  return standings.map((entry) => ({
    ...entry,
    pointsAwarded: pointsForPosition(entry.position, scoringTable),
  }));
}
