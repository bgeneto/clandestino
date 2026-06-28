import type { Group, Match, MatchStatus } from '@clandestino/shared-contracts';
import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import { validateMatchResult } from '@clandestino/tournament-engine';

export { MAX_SETS_SCORE };

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  AGENDADA: 'Agendada',
  AGUARDANDO_CONFIRMACAO: 'Aguardando confirmação',
  CONFIRMADA: 'Confirmada',
  CONTESTADA: 'Contestada',
  CORRIGIDA: 'Corrigida',
  CANCELADA: 'Cancelada',
};

export function getOpponentId(match: Match, playerId: string): string | undefined {
  const participantIds = match.participants.map((participant) => participant.playerId);
  return participantIds.find((id) => id !== playerId);
}

export function getPlayerSets(match: Match, playerId: string): number {
  return match.participants.find((participant) => participant.playerId === playerId)?.setsWon ?? 0;
}

export function sortPlayerMatches(matches: Match[]): Match[] {
  const priority: Record<MatchStatus, number> = {
    AGUARDANDO_CONFIRMACAO: 0,
    AGENDADA: 1,
    CONTESTADA: 2,
    CONFIRMADA: 3,
    CORRIGIDA: 4,
    CANCELADA: 5,
  };

  return [...matches].sort((left, right) => {
    const leftPriority = priority[left.status];
    const rightPriority = priority[right.status];
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function groupMatchesByPhase(
  matches: Match[],
  groupsById: Map<string, Group>,
): Array<{ phase: string; label: string; matches: Match[] }> {
  const grouped = new Map<string, Match[]>();

  for (const match of matches) {
    const group = groupsById.get(match.groupId);
    const phase = group?.phase ?? 'UNKNOWN';
    const current = grouped.get(phase) ?? [];
    current.push(match);
    grouped.set(phase, current);
  }

  return [...grouped.entries()].map(([phase, phaseMatches]) => ({
    phase,
    label: phase === 'GROUP_STAGE' ? 'Fase de Grupos' : 'Fase de Colocação',
    matches: sortPlayerMatches(phaseMatches),
  }));
}

export function validateScoreInput(
  setsWonByReporter: number,
  setsWonByOpponent: number,
): { valid: boolean; reason?: string } {
  const result = validateMatchResult({
    setsWonByReporter,
    setsWonByOpponent,
  });

  if (result.valid) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: translateValidationReason(result.reason),
  };
}

function translateValidationReason(reason: string | undefined): string {
  switch (reason) {
    case 'Match cannot end in a tie':
      return 'O placar não pode terminar empatado.';
    case 'Sets won exceeds maximum':
      return `Cada jogador pode ter no máximo ${MAX_SETS_SCORE} sets.`;
    case 'Sets won cannot be negative':
      return 'O placar não pode ter valores negativos.';
    default:
      return 'Placar inválido.';
  }
}

export function canConfirmMatch(match: Match, playerId: string): boolean {
  return (
    match.status === 'AGUARDANDO_CONFIRMACAO' &&
    match.resultSubmittedByPlayerId !== undefined &&
    match.resultSubmittedByPlayerId !== playerId
  );
}

export function isAwaitingOpponentConfirmation(match: Match, playerId: string): boolean {
  return match.status === 'AGUARDANDO_CONFIRMACAO' && match.resultSubmittedByPlayerId === playerId;
}
