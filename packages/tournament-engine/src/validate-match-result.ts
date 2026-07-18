import { MAX_SETS_SCORE, type MatchBestOf } from '@clandestino/shared-contracts';
import type { MatchResultInput, MatchValidationResult } from './types.js';
import { setsToWin } from './resolve-match-best-of.js';

export { MAX_SETS_SCORE };

export function validateMatchResult(
  result: MatchResultInput,
  bestOf: MatchBestOf,
): MatchValidationResult {
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

  const required = setsToWin(bestOf);
  const winnerSets = Math.max(setsWonByReporter, setsWonByOpponent);
  const loserSets = Math.min(setsWonByReporter, setsWonByOpponent);

  if (winnerSets !== required || loserSets >= required) {
    return { valid: false, reason: 'Score is impossible for match format' };
  }

  return { valid: true };
}
