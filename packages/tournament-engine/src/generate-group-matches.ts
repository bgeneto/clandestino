import type { GroupForMatches, GroupMatch } from './types.js';

/** Generates all round-robin pairings for a group. */
export function generateGroupMatches(group: GroupForMatches): GroupMatch[] {
  const matches: GroupMatch[] = [];
  const { playerIds } = group;

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({ playerA: playerIds[i]!, playerB: playerIds[j]! });
    }
  }

  return matches;
}
