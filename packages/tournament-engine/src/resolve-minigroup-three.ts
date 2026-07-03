import type { StandingMatch } from './types.js';
import { COUNTED_MATCH_STATUSES } from './types.js';

export interface MinigroupThreeResolution {
  orderedPlayerIds: [string, string, string];
  decisiveMatch: { playerA: string; playerB: string } | null;
}

function isHeadToHeadMatch(match: StandingMatch, playerA: string, playerB: string): boolean {
  return (
    (match.playerA === playerA && match.playerB === playerB) ||
    (match.playerA === playerB && match.playerB === playerA)
  );
}

function winnerOfMatch(match: StandingMatch, playerA: string, playerB: string): string | null {
  if (!isHeadToHeadMatch(match, playerA, playerB)) {
    return null;
  }

  const setsForA = match.playerA === playerA ? match.setsWonA : match.setsWonB;
  const setsForB = match.playerA === playerA ? match.setsWonB : match.setsWonA;

  if (setsForA > setsForB) {
    return playerA;
  }
  if (setsForB > setsForA) {
    return playerB;
  }

  return null;
}

export function activeStandingMatches(
  matches: StandingMatch[],
  voidedPlayerId: string,
): StandingMatch[] {
  return matches.filter(
    (match) =>
      COUNTED_MATCH_STATUSES.has(match.status) &&
      match.playerA !== voidedPlayerId &&
      match.playerB !== voidedPlayerId,
  );
}

export function resolveMinigroupThreeAfterWithdrawal(input: {
  playerIds: string[];
  withdrawnPlayerId: string;
  matches: StandingMatch[];
  positionRange: { from: number; to: number };
}): MinigroupThreeResolution {
  const { playerIds, withdrawnPlayerId, matches, positionRange } = input;
  const activePlayerIds = playerIds.filter((playerId) => playerId !== withdrawnPlayerId);

  if (activePlayerIds.length !== 2) {
    throw new Error('Minigroup resolution after withdrawal requires exactly two active players');
  }

  const [playerA, playerB] = activePlayerIds as [string, string];
  const counted = activeStandingMatches(matches, withdrawnPlayerId);
  const headToHeadWinner = counted
    .map((match) => winnerOfMatch(match, playerA, playerB))
    .find((winner) => winner !== null);

  if (headToHeadWinner) {
    const loser = headToHeadWinner === playerA ? playerB : playerA;
    return {
      orderedPlayerIds: [headToHeadWinner, loser, withdrawnPlayerId],
      decisiveMatch: null,
    };
  }

  return {
    orderedPlayerIds: [playerA, playerB, withdrawnPlayerId],
    decisiveMatch: { playerA, playerB },
  };
}

export function assignMinigroupPositions(
  resolution: MinigroupThreeResolution,
  positionRange: { from: number; to: number },
  decisiveWinnerId?: string,
): Array<{ playerId: string; position: number }> {
  const { orderedPlayerIds, decisiveMatch } = resolution;

  if (!decisiveMatch || decisiveWinnerId) {
    const winner = decisiveWinnerId ?? orderedPlayerIds[0]!;
    const loser = winner === orderedPlayerIds[0] ? orderedPlayerIds[1]! : orderedPlayerIds[0]!;
    return [
      { playerId: winner, position: positionRange.from },
      { playerId: loser, position: positionRange.from + 1 },
      { playerId: orderedPlayerIds[2]!, position: positionRange.to },
    ];
  }

  return [
    { playerId: orderedPlayerIds[0]!, position: positionRange.from },
    { playerId: orderedPlayerIds[1]!, position: positionRange.from + 1 },
    { playerId: orderedPlayerIds[2]!, position: positionRange.to },
  ];
}
