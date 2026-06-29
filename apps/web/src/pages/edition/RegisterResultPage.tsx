import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { ScoreCounter } from '../../components/edition/ScoreCounter.js';
import {
  useEditionGroups,
  useEditionParticipants,
  usePlayerMatches,
} from '../../hooks/use-edition-data.js';
import { useOnlineStatus } from '../../hooks/use-online-status.js';
import { validateScoreInput } from '../../lib/match-utils.js';
import { submitMatchResultOfflineAware } from '../../offline/submit-match-result.js';
import { queryKeys } from '../../lib/query-keys.js';
import { Alert } from '../../components/ui/Alert.js';
import type { PlayerOutletContext } from './RequirePlayerSession.js';

export function RegisterResultPage() {
  const { edition, editionId, session } = useOutletContext<PlayerOutletContext>();
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const matchesQuery = usePlayerMatches(editionId, true);
  const groupsQuery = useEditionGroups(editionId);
  const participantsQuery = useEditionParticipants(editionId);

  const match = useMemo(
    () => (matchesQuery.data ?? []).find((entry) => entry.id === matchId),
    [matchesQuery.data, matchId],
  );

  const opponentId = match?.participants.find(
    (participant) => participant.playerId !== session.playerId,
  )?.playerId;

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const groupName = useMemo(() => {
    if (!match) {
      return '';
    }

    return (
      groupsQuery.data?.groups.find((entry) => entry.group.id === match.groupId)?.group.name ?? ''
    );
  }, [groupsQuery.data, match]);

  const [reporterSets, setReporterSets] = useState(0);
  const [opponentSets, setOpponentSets] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const validation = useMemo(() => {
    if (!match) {
      return { valid: false, reason: 'Partida não encontrada.' };
    }

    return validateScoreInput(reporterSets, opponentSets);
  }, [match, reporterSets, opponentSets]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!match) {
        throw new Error('Partida não encontrada.');
      }

      return submitMatchResultOfflineAware(match.id, {
        setsWonByReporter: reporterSets,
        setsWonByOpponent: opponentSets,
      });
    },
    onSuccess: async (outcome) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.matches(editionId, 'me') });

      if (outcome.mode === 'queued') {
        setFeedback('Resultado salvo na fila — será enviado ao reconectar.');
      } else {
        setFeedback('Resultado enviado! Aguardando confirmação do adversário.');
      }

      window.setTimeout(() => {
        navigate(`/edicao/${editionId}/partidas`, { replace: true });
      }, 900);
    },
  });

  if (matchesQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando partida…</p>;
  }

  if (!match || match.status !== 'AGENDADA') {
    return <Navigate to={`/edicao/${editionId}/partidas`} replace />;
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <Link
          to={`/edicao/${editionId}/partidas`}
          className="rounded-lg bg-header px-3 py-2 text-sm text-header-foreground"
          aria-label="Voltar"
        >
          ← Voltar
        </Link>
        <h1 className="text-lg font-bold text-foreground">Registrar resultado</h1>
      </div>

      <EditionHeader edition={edition} subtitle={groupName} />
      <section className="rounded-2xl bg-card p-5 shadow-sm">
        <div className="flex min-w-0 items-end justify-between gap-1 sm:justify-around sm:gap-2">
          <ScoreCounter
            label={session.playerName ?? 'Você'}
            value={reporterSets}
            max={MAX_SETS_SCORE}
            onIncrement={() => setReporterSets((value) => Math.min(MAX_SETS_SCORE, value + 1))}
            onDecrement={() => setReporterSets((value) => Math.max(0, value - 1))}
          />
          <span
            className="mb-1.5 shrink-0 text-3xl font-bold text-muted sm:mb-2 sm:text-4xl"
            aria-hidden
          >
            ×
          </span>
          <ScoreCounter
            label={playerNames.get(opponentId ?? '') ?? 'Adversário'}
            value={opponentSets}
            max={MAX_SETS_SCORE}
            onIncrement={() => setOpponentSets((value) => Math.min(MAX_SETS_SCORE, value + 1))}
            onDecrement={() => setOpponentSets((value) => Math.max(0, value - 1))}
          />
        </div>
      </section>

      {!online ? (
        <Alert variant="warning">📶 Sem conexão — resultado será enviado ao reconectar</Alert>
      ) : null}

      {!validation.valid && (reporterSets > 0 || opponentSets > 0) ? (
        <Alert variant="danger">{validation.reason}</Alert>
      ) : null}

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <button
        type="button"
        disabled={!validation.valid || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
        className="w-full rounded-xl bg-header px-4 py-3.5 text-base font-bold text-header-foreground disabled:opacity-40"
      >
        🚀 Enviar resultado
      </button>
    </div>
  );
}
