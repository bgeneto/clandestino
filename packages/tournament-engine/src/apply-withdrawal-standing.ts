import type { GroupStandingEntry } from './types.js';

export interface WithdrawnPlayer {
  playerId: string;
  withdrawnAt: Date;
}

export function applyWithdrawalToGroupStanding(
  entries: GroupStandingEntry[],
  withdrawn: readonly WithdrawnPlayer[],
): GroupStandingEntry[] {
  if (withdrawn.length === 0) {
    return entries;
  }

  const withdrawnIds = new Set(withdrawn.map((entry) => entry.playerId));
  const active = entries.filter((entry) => !withdrawnIds.has(entry.playerId));
  const withdrawnEntries = withdrawn
    .map((entry) => {
      const stats = entries.find((candidate) => candidate.playerId === entry.playerId);
      if (!stats) {
        return null;
      }
      return { stats, withdrawnAt: entry.withdrawnAt };
    })
    .filter((entry): entry is { stats: GroupStandingEntry; withdrawnAt: Date } => entry !== null)
    .sort((left, right) => left.withdrawnAt.getTime() - right.withdrawnAt.getTime())
    .map((entry) => entry.stats);

  const ordered = [...active, ...withdrawnEntries];

  return ordered.map((entry, index) => ({
    ...entry,
    rankInGroup: index + 1,
  }));
}
