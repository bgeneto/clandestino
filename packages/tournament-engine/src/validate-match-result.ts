import type { TournamentRules } from '@clandestino/shared-contracts';
import type { MatchResultInput, MatchValidationResult } from './types.js';

export function getMatchBestOf(
  participantCount: number,
  rules: TournamentRules,
): 3 | 5 {
  return participantCount >= rules.participantThresholdForBestOfThree
    ? 3
    : rules.normalMatchBestOf;
}

export function validateMatchResult(
  result: MatchResultInput,
  _rules?: TournamentRules,
): MatchValidationResult {
  const { setsWonByReporter, setsWonByOpponent, bestOf } = result;
  const setsToWin = bestOf === 3 ? 2 : 3;
  const maxLoserSets = setsToWin - 1;

  if (setsWonByReporter < 0 || setsWonByOpponent < 0) {
    return { valid: false, reason: 'Sets won cannot be negative' };
  }

  if (setsWonByReporter > setsToWin || setsWonByOpponent > setsToWin) {
    return { valid: false, reason: 'Sets won exceeds maximum for format' };
  }

  if (setsWonByReporter + setsWonByOpponent > bestOf) {
    return { valid: false, reason: 'Total sets played exceeds best-of format' };
  }

  if (setsWonByReporter === setsWonByOpponent) {
    return { valid: false, reason: 'Match cannot end in a tie' };
  }

  const winnerSets = Math.max(setsWonByReporter, setsWonByOpponent);
  const loserSets = Math.min(setsWonByReporter, setsWonByOpponent);

  if (winnerSets !== setsToWin) {
    return { valid: false, reason: 'Winner does not have enough sets to win' };
  }

  if (loserSets > maxLoserSets) {
    return { valid: false, reason: 'Loser has too many sets for a completed match' };
  }

  return { valid: true };
}

/** All valid completed scores for a best-of format. */
export function validScoresForBestOf(bestOf: 3 | 5): Array<[number, number]> {
  const setsToWin = bestOf === 3 ? 2 : 3;
  const scores: Array<[number, number]> = [];

  for (let loser = 0; loser < setsToWin; loser++) {
    scores.push([setsToWin, loser]);
    scores.push([loser, setsToWin]);
  }

  return scores;
}

/** Scores that look plausible but violate completion rules. */
export function invalidScoresForBestOf(bestOf: 3 | 5): Array<[number, number]> {
  const invalid: Array<[number, number]> = [];
  const setsToWin = bestOf === 3 ? 2 : 3;

  for (let a = 0; a <= bestOf; a++) {
    for (let b = 0; b <= bestOf; b++) {
      if (a + b > bestOf) {
        continue;
      }
      const result = validateMatchResult({
        setsWonByReporter: a,
        setsWonByOpponent: b,
        bestOf,
      });
      if (!result.valid) {
        invalid.push([a, b]);
      }
    }
  }

  // Ensure classic impossible ties are included
  if (!invalid.some(([a, b]) => a === setsToWin && b === setsToWin)) {
    invalid.push([setsToWin, setsToWin]);
  }

  return invalid;
}
