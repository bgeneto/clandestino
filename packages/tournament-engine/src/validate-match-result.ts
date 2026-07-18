import { MAX_SETS_SCORE, MIN_WINNER_SETS } from '@clandestino/shared-contracts';
import type { MatchResultInput, MatchValidationResult } from './types.js';

export { MAX_SETS_SCORE, MIN_WINNER_SETS };

/**
 * Validates a played match score without assuming a fixed best-of format.
 * Accepts any decisive score within sport-sane bounds (winner 2–MAX sets).
 * Rejects ties, negatives, incomplete results (1×0) and absurd tallies (e.g. 7×2).
 * Walkovers are handled separately and do not go through this function.
 */
export function validateMatchResult(result: MatchResultInput): MatchValidationResult {
  const { setsWonByReporter, setsWonByOpponent } = result;

  if (setsWonByReporter < 0 || setsWonByOpponent < 0) {
    return { valid: false, reason: 'Sets won cannot be negative' };
  }

  if (setsWonByReporter > MAX_SETS_SCORE || setsWonByOpponent > MAX_SETS_SCORE) {
    return { valid: false, reason: 'Sets won exceeds maximum' };
  }

  if (setsWonByReporter === setsWonByOpponent) {
    return { valid: false, reason: 'Match cannot end in a tie' };
  }

  const winnerSets = Math.max(setsWonByReporter, setsWonByOpponent);

  if (winnerSets < MIN_WINNER_SETS) {
    return { valid: false, reason: 'Winner must win at least 2 sets' };
  }

  return { valid: true };
}
