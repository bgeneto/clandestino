import type { Group, GroupWithPlayers, Match } from '@clandestino/shared-contracts';

export const GROUP_STAGE_PHASE = 'GROUP_STAGE';
export const PLACEMENT_STAGE_PHASE = 'PLACEMENT_STAGE';

const CONFIRMED_MATCH_STATUSES = new Set<Match['status']>(['CONFIRMADA', 'CORRIGIDA']);

export function buildGroupsById(groups: GroupWithPlayers[]): Map<string, Group> {
  return new Map(groups.map((entry) => [entry.group.id, entry.group]));
}

export function filterMatchesByPhase(
  matches: Match[],
  groupsById: Map<string, Group>,
  phase: string,
): Match[] {
  return matches.filter((match) => groupsById.get(match.groupId)?.phase === phase);
}

export function countPhaseMatchProgress(
  matches: Match[],
  groupsById: Map<string, Group>,
  phase: string,
): { confirmed: number; total: number } {
  const phaseMatches = filterMatchesByPhase(matches, groupsById, phase);
  const confirmed = phaseMatches.filter((match) =>
    CONFIRMED_MATCH_STATUSES.has(match.status),
  ).length;

  return { confirmed, total: phaseMatches.length };
}

export function formatPhaseMatchProgress(label: string, confirmed: number, total: number): string {
  if (total === 0) {
    return label;
  }

  return `${confirmed}/${total} partidas de ${label} confirmadas`;
}
