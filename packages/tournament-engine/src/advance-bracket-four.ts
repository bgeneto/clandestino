import type { BracketRound } from './types.js';
import { orderPlayerPair } from './generate-bracket-matches.js';

export interface BracketSemifinalState {
  playerOneId: string;
  playerTwoId: string;
  winnerId?: string;
  loserId?: string;
  withdrawnPlayerId?: string;
  confirmed: boolean;
}

export interface BracketMatchState {
  playerOneId: string;
  playerTwoId: string;
  winnerId?: string;
  loserId?: string;
  withdrawnPlayerId?: string;
  confirmed: boolean;
}

export interface BracketFourState {
  semifinals: [BracketSemifinalState, BracketSemifinalState];
  final?: BracketMatchState;
  thirdPlace?: BracketMatchState;
}

export interface BracketMatchInput {
  bracketRound: BracketRound;
  playerOneId: string;
  playerTwoId: string;
  winnerId?: string;
  walkoverAbsentPlayerId?: string;
  confirmed: boolean;
}

export interface NextBracketMatch {
  bracketRound: 'FINAL' | 'THIRD_PLACE';
  playerOneId: string;
  playerTwoId: string;
}

export function buildBracketFourState(matches: BracketMatchInput[]): BracketFourState {
  const semifinals = matches.filter((match) => match.bracketRound === 'SEMIFINAL');
  if (semifinals.length !== 2) {
    throw new Error(`Expected 2 semifinals, got ${semifinals.length}`);
  }

  const toSemifinal = (match: BracketMatchInput): BracketSemifinalState => ({
    playerOneId: match.playerOneId,
    playerTwoId: match.playerTwoId,
    winnerId: match.winnerId,
    loserId:
      match.winnerId && match.confirmed
        ? match.winnerId === match.playerOneId
          ? match.playerTwoId
          : match.playerOneId
        : undefined,
    withdrawnPlayerId: match.walkoverAbsentPlayerId,
    confirmed: match.confirmed,
  });

  const finalMatch = matches.find((match) => match.bracketRound === 'FINAL');
  const thirdMatch = matches.find((match) => match.bracketRound === 'THIRD_PLACE');

  const toBracketMatch = (match: BracketMatchInput): BracketMatchState => ({
    playerOneId: match.playerOneId,
    playerTwoId: match.playerTwoId,
    winnerId: match.winnerId,
    loserId:
      match.winnerId && match.confirmed
        ? match.winnerId === match.playerOneId
          ? match.playerTwoId
          : match.playerOneId
        : undefined,
    withdrawnPlayerId: match.walkoverAbsentPlayerId,
    confirmed: match.confirmed,
  });

  return {
    semifinals: [toSemifinal(semifinals[0]!), toSemifinal(semifinals[1]!)],
    ...(finalMatch ? { final: toBracketMatch(finalMatch) } : {}),
    ...(thirdMatch ? { thirdPlace: toBracketMatch(thirdMatch) } : {}),
  };
}

function semifinalWinners(state: BracketFourState): [string, string] | null {
  const [sf1, sf2] = state.semifinals;
  if (!sf1.confirmed || !sf2.confirmed || !sf1.winnerId || !sf2.winnerId) {
    return null;
  }
  return [sf1.winnerId, sf2.winnerId];
}

function semifinalLosers(state: BracketFourState): [string, string] | null {
  const [sf1, sf2] = state.semifinals;
  if (!sf1.loserId || !sf2.loserId) {
    return null;
  }
  return [sf1.loserId, sf2.loserId];
}

function isWithdrawn(playerId: string, withdrawnPlayerIds: ReadonlySet<string>): boolean {
  return withdrawnPlayerIds.has(playerId);
}

export function shouldPlayThirdPlaceMatch(
  state: BracketFourState,
  withdrawnPlayerIds: ReadonlySet<string>,
): boolean {
  const losers = semifinalLosers(state);
  if (!losers) {
    return false;
  }

  const [loser1, loser2] = losers;
  return !isWithdrawn(loser1, withdrawnPlayerIds) && !isWithdrawn(loser2, withdrawnPlayerIds);
}

export function computeNextBracketMatches(
  state: BracketFourState,
  withdrawnPlayerIds: ReadonlySet<string>,
): NextBracketMatch[] {
  const winners = semifinalWinners(state);
  if (!winners) {
    return [];
  }

  const next: NextBracketMatch[] = [];
  const [winner1, winner2] = winners;

  if (!state.final) {
    next.push({
      bracketRound: 'FINAL',
      ...orderPlayerPair(winner1, winner2),
    });
    return next;
  }

  if (!state.final.confirmed && next.length === 0) {
    return next;
  }

  if (!state.thirdPlace && shouldPlayThirdPlaceMatch(state, withdrawnPlayerIds)) {
    const losers = semifinalLosers(state)!;
    next.push({
      bracketRound: 'THIRD_PLACE',
      ...orderPlayerPair(losers[0], losers[1]),
    });
  }

  return next;
}

export interface WithdrawnBandPlayer {
  playerId: string;
  withdrawnAt: Date;
}

export function resolveBracketFourPositions(
  state: BracketFourState,
  positionRange: { from: number; to: number },
  withdrawnPlayers: readonly WithdrawnBandPlayer[],
): string[] {
  const slots: Array<string | null> = [null, null, null, null];
  const withdrawnIds = new Set(withdrawnPlayers.map((entry) => entry.playerId));

  const assignWithdrawn = () => {
    const sorted = [...withdrawnPlayers].sort(
      (left, right) => left.withdrawnAt.getTime() - right.withdrawnAt.getTime(),
    );
    let index = 3;
    for (const entry of sorted) {
      slots[index] = entry.playerId;
      index -= 1;
    }
  };

  const [sf1, sf2] = state.semifinals;
  const sfWinners = semifinalWinners(state);
  const sfLosers = semifinalLosers(state);

  if (sfWinners && !state.final?.confirmed) {
    if (slots[0] === null) {
      slots[0] = sfWinners[0];
    }
    if (slots[1] === null) {
      slots[1] = sfWinners[1];
    }
  }

  if (state.final?.confirmed && state.final.winnerId) {
    const champion = state.final.winnerId;
    const runnerUp = state.final.loserId ?? null;
    slots[0] = champion;
    if (runnerUp && !withdrawnIds.has(runnerUp)) {
      slots[1] = runnerUp;
    }
  } else if (state.final?.confirmed && state.final.withdrawnPlayerId) {
    const champion =
      state.final.winnerId ??
      (state.final.withdrawnPlayerId === state.final.playerOneId
        ? state.final.playerTwoId
        : state.final.playerOneId);
    slots[0] = champion;
  }

  if (state.thirdPlace?.confirmed && state.thirdPlace.winnerId) {
    slots[2] = state.thirdPlace.winnerId;
    if (state.thirdPlace.loserId && !withdrawnIds.has(state.thirdPlace.loserId)) {
      slots[3] = state.thirdPlace.loserId;
    }
  } else if (!shouldPlayThirdPlaceMatch(state, withdrawnIds) && sfLosers && sfWinners) {
    const activeLosers = sfLosers.filter((playerId) => !withdrawnIds.has(playerId));
    if (activeLosers.length === 1 && slots[2] === null) {
      slots[2] = activeLosers[0]!;
    }
  }

  assignWithdrawn();

  const result: string[] = [];
  for (let offset = 0; offset < 4; offset++) {
    const playerId = slots[offset];
    if (playerId) {
      result.push(playerId);
    }
  }

  const assigned = new Set(result);
  const allPlayers = new Set<string>([
    sf1.playerOneId,
    sf1.playerTwoId,
    sf2.playerOneId,
    sf2.playerTwoId,
  ]);

  for (const playerId of allPlayers) {
    if (!assigned.has(playerId) && !withdrawnIds.has(playerId)) {
      result.push(playerId);
    }
  }

  for (const entry of withdrawnPlayers) {
    if (!result.includes(entry.playerId)) {
      result.push(entry.playerId);
    }
  }

  if (result.length !== 4) {
    throw new Error('Could not resolve all four bracket positions');
  }

  return result;
}
