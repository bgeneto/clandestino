import { createSeededRng, shuffle } from './rng.js';
import type { BracketRound } from './types.js';

export function shufflePlayers(playerIds: string[], seed: string): string[] {
  return shuffle([...playerIds], createSeededRng(seed));
}

export interface BracketSemifinalPairing {
  playerA: string;
  playerB: string;
  bracketRound: BracketRound;
}

/** After shuffle: pair indices (0,3) and (1,2). */
export function generateBracketSemifinals(
  playerIds: string[],
  seed: string,
): BracketSemifinalPairing[] {
  if (playerIds.length !== 4) {
    throw new Error(`Bracket semifinals require exactly 4 players, got ${playerIds.length}`);
  }

  const ordered = shufflePlayers(playerIds, seed);

  return [
    { playerA: ordered[0]!, playerB: ordered[3]!, bracketRound: 'SEMIFINAL' },
    { playerA: ordered[1]!, playerB: ordered[2]!, bracketRound: 'SEMIFINAL' },
  ];
}

export function orderPlayerPair(
  playerA: string,
  playerB: string,
): {
  playerOneId: string;
  playerTwoId: string;
} {
  return playerA < playerB
    ? { playerOneId: playerA, playerTwoId: playerB }
    : { playerOneId: playerB, playerTwoId: playerA };
}
