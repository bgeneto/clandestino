import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { MatchResultForm } from '../../components/edition/MatchResultForm.js';
import {
  useEditionGroups,
  useEditionParticipants,
  usePlayerMatches,
} from '../../hooks/use-edition-data.js';
import { useOnlineStatus } from '../../hooks/use-online-status.js';
import { submitMatchResultOfflineAware } from '../../offline/submit-match-result.js';
import { queryKeys } from '../../lib/query-keys.js';
import { Alert } from '../../components/ui/Alert.js';
import { useNotification } from '../../notifications/notification-context.js';
import type { PlayerOutletContext } from './RequirePlayerSession.js';

export function RegisterResultPage() {
  const { edition, editionId, session } = useOutletContext<PlayerOutletContext>();
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const notify = useNotification();
  const redirectTimerRef = useRef<number | null>(null);
  const matchesQuery = usePlayerMatches(editionId, true);
  const groupsQuery = useEditionGroups(editionId);
  const participantsQuery = useEditionParticipants(editionId);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

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

  const submitMutation = useMutation({
    // Precisa rodar offline para enfileirar no IndexedDB (default 'online' pausa a mutation).
    networkMode: 'always',
    mutationFn: async (
      payload:
        | { outcome: 'PLAYED'; setsWonByReporter: number; setsWonByOpponent: number }
        | { outcome: 'WALKOVER'; absentPlayerId: string },
    ) => {
      if (!match) {
        throw new Error('Partida não encontrada.');
      }

      if (payload.outcome === 'WALKOVER') {
        return submitMatchResultOfflineAware(match.id, {
          outcome: 'WALKOVER',
          absentPlayerId: payload.absentPlayerId,
        });
      }

      return submitMatchResultOfflineAware(match.id, {
        outcome: 'PLAYED',
        setsWonByReporter: payload.setsWonByReporter,
        setsWonByOpponent: payload.setsWonByOpponent,
      });
    },
    onSuccess: async (outcome) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.matchesForEdition(editionId) });

      if (outcome.mode === 'queued') {
        notify.success('Resultado salvo na fila — será enviado ao reconectar.');
      } else if (outcome.match.outcome === 'WALKOVER') {
        notify.success('Vitória por WO registrada e confirmada.');
      } else {
        notify.success('Resultado enviado! Aguardando confirmação do adversário.');
      }

      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        redirectTimerRef.current = null;
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
      <MatchResultForm
        reporterLabel={session.playerName ?? 'Você'}
        opponentLabel={playerNames.get(opponentId ?? '') ?? 'Adversário'}
        opponentId={opponentId ?? ''}
        pending={submitMutation.isPending}
        submitLabel="🚀 Enviar resultado"
        onSubmit={(payload) => submitMutation.mutate(payload)}
      />

      {!online ? (
        <Alert variant="warning">📶 Sem conexão — resultado será enviado ao reconectar</Alert>
      ) : null}
    </div>
  );
}
