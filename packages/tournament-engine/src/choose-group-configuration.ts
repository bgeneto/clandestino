import type { GroupConfiguration, TournamentRules } from './types.js';

export function chooseGroupConfiguration(
  playerCount: number,
  rules: TournamentRules,
): GroupConfiguration {
  if (playerCount < rules.minimumGroupSize) {
    throw new Error(
      `At least ${rules.minimumGroupSize} players are required, got ${playerCount}`,
    );
  }

  const maxGroups = Math.floor(playerCount / rules.minimumGroupSize);
  let best: GroupConfiguration | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let groupCount = 1; groupCount <= maxGroups; groupCount++) {
    if (groupCount * rules.maximumGroupSize < playerCount) {
      continue;
    }
    if (groupCount * rules.minimumGroupSize > playerCount) {
      continue;
    }

    const base = Math.floor(playerCount / groupCount);
    const remainder = playerCount % groupCount;
    const groupSizes: number[] = [];
    for (let i = 0; i < groupCount; i++) {
      groupSizes.push(i < remainder ? base + 1 : base);
    }

    if (
      !groupSizes.every(
        (size) => size >= rules.minimumGroupSize && size <= rules.maximumGroupSize,
      )
    ) {
      continue;
    }

    const score = groupSizes.reduce(
      (sum, size) => sum + Math.abs(size - rules.preferredGroupSize),
      0,
    );
    if (score < bestScore) {
      bestScore = score;
      best = { groupCount, groupSizes };
    }
  }

  if (!best) {
    throw new Error(`Cannot partition ${playerCount} players into valid groups`);
  }

  return best;
}
