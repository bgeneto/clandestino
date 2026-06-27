import { createSeededRng, shuffle } from './rng.js';
import type { DrawGroupInput } from './types.js';

/** Draws unseeded players into groups using a reproducible random seed. */
export function drawUnseededPlayers(
  players: string[],
  groups: DrawGroupInput[],
  seed: string,
): DrawGroupInput[] {
  const rng = createSeededRng(seed);
  const shuffled = shuffle(players, rng);
  const result = groups.map((group) => ({
    ...group,
    players: [...group.players],
  }));

  let groupIndex = 0;
  for (const playerId of shuffled) {
    let attempts = 0;
    while (
      result[groupIndex]!.players.length >= result[groupIndex]!.targetSize &&
      attempts < result.length
    ) {
      groupIndex = (groupIndex + 1) % result.length;
      attempts++;
    }

    const currentGroup = result[groupIndex]!;
    if (currentGroup.players.length < currentGroup.targetSize) {
      currentGroup.players.push({ playerId, isSeed: false });
    }

    groupIndex = (groupIndex + 1) % result.length;
  }

  return result;
}
