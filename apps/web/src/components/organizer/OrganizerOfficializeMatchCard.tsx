import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@clandestino/shared-contracts';
import { MatchResultForm } from '../edition/MatchResultForm.js';
import type { MatchResultSubmitPayload } from '../edition/MatchResultForm.js';
import { formatMatchScore } from '../../lib/format.js';
import { officializeMatchResult } from '../../lib/organizer-api.js';
import { invalidateEditionAfterMatchOfficialized } from '../../lib/invalidate-edition-queries.js';
import { notifyApiError } from '../../notifications/notify-api-error.js';
import { useNotification } from '../../notifications/notification-context.js';

type OrganizerOfficializeMatchCardProps = {
  match: Match;
  playerNames: Map<string, string>;
  editionId: string;
  variant: 'contested' | 'pending' | 'awaiting-player';
  contestReason?: string | null;
};

function getPlayerOneId(match: Match): string {
  return match.participants[0]?.playerId ?? '';
}

function getPlayerTwoId(match: Match): string {
  return match.participants[1]?.playerId ?? '';
}

export function OrganizerOfficializeMatchCard({
  match,
  playerNames,
  editionId,
  variant,
  contestReason,
}: OrganizerOfficializeMatchCardProps) {
  const queryClient = useQueryClient();
  const notify = useNotification();
  const playerOneId = getPlayerOneId(match);
  const playerTwoId = getPlayerTwoId(match);
  const [confirmedOfficial, setConfirmedOfficial] = useState(false);
  const [showManualOfficialize, setShowManualOfficialize] = useState(false);
  const submittedPlayerOneSets =
    match.participants.find((participant) => participant.playerId === playerOneId)?.setsWon ?? 0;
  const submittedPlayerTwoSets =
    match.participants.find((participant) => participant.playerId === playerTwoId)?.setsWon ?? 0;
  const hasPlayerSubmittedScore =
    match.status === 'AGUARDANDO_CONFIRMACAO' || match.status === 'CONTESTADA';

  const officializeMutation = useMutation({
    mutationFn: (payload: MatchResultSubmitPayload) => {
      if (payload.outcome === 'WALKOVER') {
        return officializeMatchResult(match.id, {
          outcome: 'WALKOVER',
          absentPlayerId: payload.absentPlayerId,
        });
      }

      return officializeMatchResult(match.id, {
        outcome: 'PLAYED',
        setsWonByPlayerOne: payload.setsWonByReporter,
        setsWonByPlayerTwo: payload.setsWonByOpponent,
      });
    },
    onSuccess: async () => {
      notify.success(
        variant === 'contested'
          ? 'Resultado corrigido e oficializado. A classificação foi atualizada.'
          : 'Resultado oficializado. A classificação foi atualizada.',
      );
      await invalidateEditionAfterMatchOfficialized(queryClient, editionId);
    },
    onError: (error) => {
      notifyApiError(
        notify,
        error,
        variant === 'contested'
          ? 'Não foi possível corrigir o placar.'
          : 'Não foi possível oficializar o placar.',
      );
    },
  });

  const isContested = variant === 'contested';
  const isAwaitingPlayer = variant === 'awaiting-player';
  const cardClass = isContested
    ? 'border-danger-surface bg-danger-surface'
    : isAwaitingPlayer
      ? 'border-line bg-card-muted'
      : 'border-warning-surface bg-warning-surface';
  const metaTextClass = isContested
    ? 'text-danger-foreground'
    : isAwaitingPlayer
      ? 'text-muted'
      : 'text-warning-foreground';

  const reportedScore = formatMatchScore(match.participants, playerOneId, playerTwoId);
  const hasReportedScore =
    isContested || (!isContested && match.status === 'AGUARDANDO_CONFIRMACAO');

  return (
    <article className={`rounded-lg border p-4 ${cardClass}`}>
      <p className="text-sm font-semibold text-foreground">
        {playerNames.get(playerOneId) ?? 'Jogador 1'} vs{' '}
        {playerNames.get(playerTwoId) ?? 'Jogador 2'}
      </p>
      {hasReportedScore ? (
        <>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-wide text-foreground">
            {reportedScore}
          </p>
          <p className={`mt-1 text-xs ${metaTextClass}`}>
            {isContested
              ? 'Placar contestado'
              : isAwaitingPlayer
                ? 'Placar aguardando confirmação do adversário'
                : 'Placar informado'}
          </p>
        </>
      ) : null}
      {!isContested && match.status === 'AGENDADA' ? (
        <p className={`mt-1 text-xs ${metaTextClass}`}>
          Nenhum resultado registrado pelos jogadores.
        </p>
      ) : null}
      {contestReason ? (
        <p className={`mt-2 text-sm ${metaTextClass}`}>
          <span className="font-medium">Motivo:</span> {contestReason}
        </p>
      ) : null}

      <div className="mt-4">
        {isAwaitingPlayer && !showManualOfficialize ? (
          <button
            type="button"
            onClick={() => setShowManualOfficialize(true)}
            className="w-full rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-foreground"
          >
            Oficializar manualmente
          </button>
        ) : (
          <MatchResultForm
            organizerMode
            playerOneId={playerOneId}
            playerTwoId={playerTwoId}
            playerOneLabel={playerNames.get(playerOneId) ?? 'Jogador 1'}
            playerTwoLabel={playerNames.get(playerTwoId) ?? 'Jogador 2'}
            reporterLabel={playerNames.get(playerOneId) ?? 'Jogador 1'}
            opponentLabel={playerNames.get(playerTwoId) ?? 'Jogador 2'}
            opponentId={playerTwoId}
            initialPlayerOneSets={hasPlayerSubmittedScore ? submittedPlayerOneSets : undefined}
            initialPlayerTwoSets={hasPlayerSubmittedScore ? submittedPlayerTwoSets : undefined}
            disabled={!confirmedOfficial}
            pending={officializeMutation.isPending}
            submitLabel={isContested ? 'Oficializar resultado corrigido' : 'Oficializar resultado'}
            onSubmit={(payload) => void officializeMutation.mutateAsync(payload)}
          />
        )}
      </div>

      {!isAwaitingPlayer || showManualOfficialize ? (
        <label className={`mt-4 flex items-start gap-2 text-sm text-muted`}>
          <input
            type="checkbox"
            checked={confirmedOfficial}
            onChange={(event) => setConfirmedOfficial(event.target.checked)}
            className="mt-1"
          />
          <span>
            {isContested
              ? 'Confirmo que o resultado corrigido é oficial e substitui o placar contestado.'
              : 'Confirmo que o resultado informado é oficial.'}
          </span>
        </label>
      ) : null}
    </article>
  );
}
