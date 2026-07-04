import type { Edition, Group, GroupWithPlayers, Match } from '@clandestino/shared-contracts';
import { isMatchResolvedForEditionClose } from '@clandestino/shared-contracts';

export const GROUP_STAGE_PHASE = 'GROUP_STAGE';
export const PLACEMENT_STAGE_PHASE = 'PLACEMENT_STAGE';

const CONFIRMED_MATCH_STATUSES = new Set<Match['status']>(['CONFIRMADA', 'CORRIGIDA']);
const PENDING_ORGANIZER_STATUSES = new Set<Match['status']>(['AGENDADA', 'AGUARDANDO_CONFIRMACAO']);

const HIDE_FINALIZE_STATUSES: Edition['status'][] = [
  'RASCUNHO',
  'INSCRICOES_ABERTAS',
  'SORTEIO_PUBLICADO',
  'ENCERRADA',
];

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

export function getPendingMatches(matches: Match[]): Match[] {
  return matches.filter((match) => PENDING_ORGANIZER_STATUSES.has(match.status));
}

export function shouldShowFinalizeSection(status: Edition['status']): boolean {
  return !HIDE_FINALIZE_STATUSES.includes(status);
}

export function getEditionFinalizeBlockers(
  edition: Edition,
  matches: Match[],
  groups: GroupWithPlayers[],
): string[] {
  const blockers: string[] = [];

  if (edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS') {
    blockers.push('O torneio ainda não foi iniciado.');
    return blockers;
  }

  if (edition.status === 'SORTEIO_PUBLICADO') {
    blockers.push('Gere as partidas antes de encerrar a edição.');
    return blockers;
  }

  const pendingCount = matches.filter(
    (match) => !isMatchResolvedForEditionClose(match.status),
  ).length;

  if (pendingCount > 0) {
    blockers.push(`Ainda há ${pendingCount} partida(s) sem resultado confirmado.`);
  }

  if (edition.status === 'FASE_COLOCACAO') {
    const placementGroups = groups.filter((entry) => entry.group.phase === PLACEMENT_STAGE_PHASE);
    if (placementGroups.length > 0) {
      const groupsById = buildGroupsById(groups);
      const hasPlacementMatches = matches.some((match) => {
        const phase = groupsById.get(match.groupId)?.phase;
        return phase === PLACEMENT_STAGE_PHASE && match.status !== 'CANCELADA';
      });

      if (!hasPlacementMatches) {
        blockers.push('Publique a fase de colocação antes de encerrar.');
      }
    }
  }

  return blockers;
}

export function canFinalizeEdition(
  edition: Edition,
  matches: Match[],
  groups: GroupWithPlayers[],
): boolean {
  return getEditionFinalizeBlockers(edition, matches, groups).length === 0;
}
