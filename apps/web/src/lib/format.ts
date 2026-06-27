import type { Edition, EditionStatus } from '@clandestino/shared-contracts';

const EDITION_STATUS_LABELS: Record<EditionStatus, string> = {
  RASCUNHO: 'Rascunho',
  INSCRICOES_ABERTAS: 'Inscrições abertas',
  SORTEIO_PUBLICADO: 'Sorteio publicado',
  EM_ANDAMENTO: 'Em andamento',
  FASE_COLOCACAO: 'Fase de colocação',
  ENCERRADA: 'Encerrada',
};

export function formatEditionDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatEditionTitle(edition: Edition): string {
  return `${edition.name} — ${formatEditionDate(edition.date)}`;
}

export function formatEditionStatus(status: EditionStatus): string {
  return EDITION_STATUS_LABELS[status];
}

export function formatMatchScore(
  participants: Array<{ playerId: string; setsWon: number }>,
  playerOneId: string,
  playerTwoId: string,
): string {
  const playerOne = participants.find((participant) => participant.playerId === playerOneId);
  const playerTwo = participants.find((participant) => participant.playerId === playerTwoId);

  return `${playerOne?.setsWon ?? 0} × ${playerTwo?.setsWon ?? 0}`;
}
