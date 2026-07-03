import { describe, expect, it } from 'vitest';
import {
  buildBracketFourState,
  computeNextBracketMatches,
  resolveBracketFourPositions,
  shouldPlayThirdPlaceMatch,
  type BracketMatchInput,
} from './advance-bracket-four.js';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const P3 = '33333333-3333-4333-8333-333333333333';
const P4 = '44444444-4444-4444-8444-444444444444';

function semifinal(
  playerOneId: string,
  playerTwoId: string,
  winnerId: string,
  walkoverAbsentPlayerId?: string,
): BracketMatchInput {
  return {
    bracketRound: 'SEMIFINAL',
    playerOneId,
    playerTwoId,
    winnerId,
    walkoverAbsentPlayerId,
    confirmed: true,
  };
}

describe('advance-bracket-four', () => {
  it('generates final after both semifinals are confirmed', () => {
    const state = buildBracketFourState([semifinal(P1, P4, P1), semifinal(P2, P3, P2)]);

    const next = computeNextBracketMatches(state, new Set());
    expect(next).toEqual([
      {
        bracketRound: 'FINAL',
        playerOneId: P1,
        playerTwoId: P2,
      },
    ]);
  });

  it('skips third place when a semifinal loser withdrew', () => {
    const state = buildBracketFourState([semifinal(P1, P4, P1, P4), semifinal(P2, P3, P2)]);

    expect(shouldPlayThirdPlaceMatch(state, new Set([P4]))).toBe(false);

    const withFinal = {
      ...state,
      final: {
        playerOneId: P1,
        playerTwoId: P2,
        winnerId: P1,
        loserId: P2,
        confirmed: true,
      },
    };

    expect(computeNextBracketMatches(withFinal, new Set([P4]))).toEqual([]);
  });

  it('resolves positions when loser withdraws before final', () => {
    const state = buildBracketFourState([semifinal(P1, P4, P1), semifinal(P2, P3, P2, P3)]);

    const positions = resolveBracketFourPositions(state, { from: 5, to: 8 }, [
      { playerId: P3, withdrawnAt: new Date('2026-01-02T12:00:00Z') },
    ]);

    expect(positions).toEqual([P1, P2, P4, P3]);
  });

  it('resolves champion when finalist withdraws before playing final', () => {
    const state = buildBracketFourState([semifinal(P1, P4, P1), semifinal(P2, P3, P2)]);

    const withFinal = {
      ...state,
      final: {
        playerOneId: P1,
        playerTwoId: P2,
        winnerId: P2,
        withdrawnPlayerId: P1,
        confirmed: true,
      },
    };

    const positions = resolveBracketFourPositions(withFinal, { from: 1, to: 4 }, [
      { playerId: P1, withdrawnAt: new Date('2026-01-03T12:00:00Z') },
    ]);

    expect(positions[0]).toBe(P2);
    expect(positions).toContain(P1);
    expect(positions).toHaveLength(4);
  });
});
