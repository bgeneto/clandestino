import { Link } from 'react-router-dom';
import type { Match } from '@clandestino/shared-contracts';
import {
  MATCH_STATUS_LABELS,
  bracketRoundLabel,
  canConfirmMatch,
  getOpponentId,
  getPlayerSets,
  isAwaitingOpponentConfirmation,
} from '../../lib/match-utils.js';
import { formatMatchScore } from '../../lib/format.js';

type MatchCardProps = {
  match: Match;
  playerId: string;
  opponentName: string;
  playerName: string;
  phaseLabel?: string;
  editionId: string;
  onConfirm?: (matchId: string) => void;
  onContest?: (matchId: string) => void;
  confirming?: boolean;
};

function cardBorderClass(status: Match['status'], awaitingConfirmation: boolean): string {
  if (awaitingConfirmation) {
    return 'border-l-4 border-l-amber-500';
  }

  if (status === 'CONFIRMADA' || status === 'CORRIGIDA') {
    return 'border-l-4 border-l-emerald-500';
  }

  if (status === 'CONTESTADA') {
    return 'border-l-4 border-l-rose-500';
  }

  return 'border border-line';
}

function statusClass(status: Match['status'], awaitingConfirmation: boolean): string {
  if (awaitingConfirmation) {
    return 'font-medium text-amber-600';
  }

  if (status === 'CONFIRMADA' || status === 'CORRIGIDA') {
    return 'font-medium text-emerald-600';
  }

  if (status === 'CONTESTADA') {
    return 'font-medium text-rose-600';
  }

  return 'text-subtle';
}

function statusLabel(match: Match, playerId: string): string {
  if (canConfirmMatch(match, playerId)) {
    return '⏳ Aguardando sua confirmação';
  }

  if (isAwaitingOpponentConfirmation(match, playerId)) {
    return 'Aguardando confirmação do adversário';
  }

  if (match.status === 'CONFIRMADA') {
    return '✓ Confirmada';
  }

  if (match.status === 'CONTESTADA') {
    return 'Contestada — aguardando organizador';
  }

  return MATCH_STATUS_LABELS[match.status];
}

export function MatchCard({
  match,
  playerId,
  opponentName,
  playerName,
  phaseLabel,
  editionId,
  onConfirm,
  onContest,
  confirming = false,
}: MatchCardProps) {
  const awaitingConfirmation = canConfirmMatch(match, playerId);
  const hasScore = match.status !== 'AGENDADA';
  const opponentId = getOpponentId(match, playerId);
  const roundLabel = bracketRoundLabel(match.bracketRound);
  const displayPhaseLabel = [phaseLabel, roundLabel].filter(Boolean).join(' · ') || undefined;
  const isWalkover = match.outcome === 'WALKOVER';

  return (
    <article
      className={`rounded-xl bg-card p-4 shadow-sm ${cardBorderClass(match.status, awaitingConfirmation)}`}
    >
      {displayPhaseLabel ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-subtle">
          {displayPhaseLabel}
        </p>
      ) : null}
      <p className="text-[15px] font-semibold text-foreground">
        {playerName} vs {opponentName}
      </p>
      <p className={`mt-1 text-xs ${statusClass(match.status, awaitingConfirmation)}`}>
        {statusLabel(match, playerId)}
      </p>

      {hasScore ? (
        <p className="mt-2 text-lg font-bold text-foreground">
          {getPlayerSets(match, playerId)} × {opponentId ? getPlayerSets(match, opponentId) : '?'}
          {isWalkover ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              WO
            </span>
          ) : null}
        </p>
      ) : null}

      {match.status === 'AGENDADA' ? (
        <Link
          to={`/edicao/${editionId}/partidas/${match.id}/registrar`}
          className="mt-3 inline-flex rounded-lg bg-header px-3.5 py-2 text-sm font-semibold text-header-foreground"
        >
          Registrar resultado
        </Link>
      ) : null}

      {awaitingConfirmation ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={() => onConfirm?.(match.id)}
            className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={() => onContest?.(match.id)}
            className="rounded-lg border border-rose-500 px-3.5 py-2 text-sm font-semibold text-rose-600 disabled:opacity-60"
          >
            Contestar
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function PublicMatchRow({
  match,
  playerNames,
  groupName,
}: {
  match: Match;
  playerNames: Map<string, string>;
  groupName: string;
}) {
  const [playerOneId, playerTwoId] = match.participants.map((participant) => participant.playerId);
  const playerOneName = playerNames.get(playerOneId ?? '') ?? 'Jogador A';
  const playerTwoName = playerNames.get(playerTwoId ?? '') ?? 'Jogador B';

  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <p className="text-sm font-medium text-foreground">
        {playerOneName} vs {playerTwoName}
      </p>
      <p className="mt-1 text-xs text-subtle">
        {groupName}
        {bracketRoundLabel(match.bracketRound)
          ? ` · ${bracketRoundLabel(match.bracketRound)}`
          : ''}{' '}
        · {MATCH_STATUS_LABELS[match.status]}
        {match.outcome === 'WALKOVER' ? ' · WO' : ''}
      </p>
      {match.status !== 'AGENDADA' ? (
        <p className="mt-1 text-sm font-semibold text-foreground">
          {formatMatchScore(match.participants, playerOneId!, playerTwoId!)}
        </p>
      ) : null}
    </div>
  );
}
