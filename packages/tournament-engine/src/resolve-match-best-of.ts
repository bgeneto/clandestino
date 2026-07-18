import type { EditionRules, MatchBestOf } from '@clandestino/shared-contracts';

export function setsToWin(bestOf: MatchBestOf): number {
  return Math.ceil(bestOf / 2);
}

export function resolveMatchBestOf(
  rules: Pick<EditionRules, 'normalMatchBestOf' | 'participantThresholdForBestOfThree'>,
  participantCount: number,
): MatchBestOf {
  if (participantCount >= rules.participantThresholdForBestOfThree) {
    return 3;
  }

  return rules.normalMatchBestOf;
}
