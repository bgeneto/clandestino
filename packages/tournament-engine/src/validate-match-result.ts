import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import type { MatchResultInput, MatchValidationResult } from './types.js';

export { MAX_SETS_SCORE };

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

  return { valid: true };
}
