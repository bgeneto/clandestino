import type { SeedAssignment } from './types.js';

function extraSeedGroupIndex(extraIndex: number, groupCount: number): number {
  const round = Math.floor(extraIndex / groupCount);
  const posInRound = extraIndex % groupCount;
  if (round % 2 === 0) {
    return groupCount - 1 - posInRound;
  }
  return posInRound;
}

/** Distributes seeds: one per group first, then snake for additional protected seeds. */
export function allocateSeededPlayers(
  seeds: string[],
  groupCount: number,
): SeedAssignment[] {
  if (groupCount < 1) {
    throw new Error('groupCount must be at least 1');
  }

  return seeds.map((playerId, index) => {
    const groupIndex =
      index < groupCount ? index : extraSeedGroupIndex(index - groupCount, groupCount);
    return { groupIndex, playerId };
  });
}
