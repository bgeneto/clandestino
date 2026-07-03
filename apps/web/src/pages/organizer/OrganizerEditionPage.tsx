import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContestedMatch, Edition, Match } from '@clandestino/shared-contracts';
import { GroupsView } from '../../components/edition/GroupsView.js';
import { MatchResultForm } from '../../components/edition/MatchResultForm.js';
import { EditionTournamentOverview } from '../../components/organizer/EditionTournamentOverview.js';
import { DrawAuditPanel } from '../../components/organizer/DrawAuditPanel.js';
import { EditionAccessSection } from '../../components/organizer/EditionAccessSection.js';
import {
  useChampionshipRoster,
  useContestedMatches,
  useDrawSnapshots,
  useEditionRegistrations,
  useFinalPlacements,
} from '../../hooks/use-organizer-data.js';
import {
  useEditionGroups,
  useEditionMatches,
  useEditionParticipants,
} from '../../hooks/use-edition-data.js';
import { useEdition } from '../../hooks/use-edition.js';
import { Alert } from '../../components/ui/Alert.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { useEditionSse } from '../../hooks/use-edition-sse.js';
import { getDrawReadinessWarning } from '../../lib/draw-utils.js';
import { isPlayerShuffleEnabled } from '../../lib/feature-flags.js';
import { formatEditionStatus, formatEditionTitle, formatMatchScore } from '../../lib/format.js';
import {
  cancelDraw,
  correctMatchResult,
  deleteEdition,
  executeDraw,
  finalizeEdition,
  generateMatches,
  publishPlacementStage,
  registerPlayer,
  unregisterPlayer,
  withdrawPlayer,
} from '../../lib/organizer-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { invalidateEditionQueries } from '../../lib/invalidate-edition-queries.js';
import { purgeEditionLocalState } from '../../lib/purge-edition-state.js';
import { notifyApiError } from '../../notifications/notify-api-error.js';
import { useNotification } from '../../notifications/notification-context.js';

function getPlayerOneId(match: Match): string {
  return match.participants[0]?.playerId ?? '';
}

function getPlayerTwoId(match: Match): string {
  return match.participants[1]?.playerId ?? '';
}

function RegistrationsSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const notify = useNotification();
  const rosterQuery = useChampionshipRoster(edition.championshipId);
  const registrationsQuery = useEditionRegistrations(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);
  const [search, setSearch] = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);

  const registeredIds = useMemo(
    () => new Set((registrationsQuery.data ?? []).map((entry) => entry.playerId)),
    [registrationsQuery.data],
  );

  const filteredPlayers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const players = [...(rosterQuery.data ?? [])].sort((left, right) =>
      left.playerName.localeCompare(right.playerName, 'pt-BR'),
    );

    if (!normalized) {
      return players;
    }

    return players.filter((player) => player.playerName.toLowerCase().includes(normalized));
  }, [rosterQuery.data, search]);

  const toggleMutation = useMutation({
    mutationFn: async (playerId: string) => {
      if (registeredIds.has(playerId)) {
        return unregisterPlayer(edition.id, playerId);
      }
      return registerPlayer(edition.id, { playerId });
    },
    onSuccess: async (_data, playerId) => {
      notify.success(registeredIds.has(playerId) ? 'Jogador desinscrito.' : 'Jogador inscrito.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.registrations(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.participants(edition.id) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.championshipRoster(edition.championshipId),
        }),
      ]);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível atualizar a inscrição do jogador.');
    },
  });

  const canRegister = edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS';
  const canWithdraw = edition.status === 'EM_ANDAMENTO' || edition.status === 'FASE_COLOCACAO';

  const withdrawMutation = useMutation({
    mutationFn: (playerId: string) => withdrawPlayer(edition.id, playerId),
    onSuccess: async () => {
      notify.success('Jogador registrado como desistente.');
      setWithdrawTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.participants(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matches(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.standings(edition.id) }),
      ]);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível registrar a desistência.');
    },
  });

  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const participantCount = participantsQuery.data?.length ?? 0;

  return (
    <details className="group rounded-xl bg-card p-4 shadow-sm">
      <summary className="mb-4 flex cursor-pointer list-none items-center justify-between text-sm font-bold uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
        <span>Inscrições ({participantCount})</span>
        <span aria-hidden className="text-[10px] transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>

      {canRegister ? (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogador no cadastro…"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <div className="scrollable-list max-h-64 space-y-2 overflow-y-auto pr-1">
            {filteredPlayers.map((player) => {
              const isRegistered = registeredIds.has(player.playerId);
              return (
                <button
                  key={player.playerId}
                  type="button"
                  disabled={toggleMutation.isPending}
                  onClick={() => void toggleMutation.mutateAsync(player.playerId)}
                  className={[
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                    isRegistered
                      ? 'border-brand bg-brand/10 hover:bg-brand/15'
                      : 'border-line hover:bg-card-muted',
                  ].join(' ')}
                >
                  <span>{player.playerName}</span>
                  <span className={`text-xs ${isRegistered ? 'text-subtle' : 'text-brand'}`}>
                    {isRegistered ? 'Inscrito' : 'Inscrever'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <ul className="space-y-2">
        {(participantsQuery.data ?? []).map((participant) => {
          const hasDrawSeeds = (participantsQuery.data ?? []).some((entry) => entry.isSeed);
          const isSeed = hasDrawSeeds
            ? participant.isSeed
            : participant.rankPosition <= edition.rules.protectedSeedCount;

          return (
            <li
              key={participant.playerId}
              className="flex items-center justify-between rounded-lg bg-card-muted px-3 py-2 text-sm"
            >
              <span>{participantNames.get(participant.playerId) ?? participant.playerName}</span>
              <div className="flex items-center gap-2 text-xs text-subtle">
                <span>{participant.rankPosition}º</span>
                <span>{participant.accumulatedPoints} pts</span>
                {participant.withdrawnAt ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                    Desistente
                  </span>
                ) : null}
                {isSeed ? (
                  <span className="rounded-full bg-amber-300 px-2 py-0.5 font-bold text-amber-950 dark:bg-amber-400">
                    SEED
                  </span>
                ) : null}
                {canWithdraw && !participant.withdrawnAt ? (
                  <button
                    type="button"
                    className="rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700"
                    onClick={() =>
                      setWithdrawTarget({
                        playerId: participant.playerId,
                        playerName:
                          participantNames.get(participant.playerId) ?? participant.playerName,
                      })
                    }
                  >
                    Retirar
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        isOpen={withdrawTarget !== null}
        title="Registrar desistência"
        description={
          withdrawTarget
            ? `Confirmar que ${withdrawTarget.playerName} desistiu da edição? Partidas pendentes serão tratadas conforme as regras da fase atual.`
            : ''
        }
        confirmLabel="Confirmar desistência"
        variant="warning"
        isLoading={withdrawMutation.isPending}
        onCancel={() => setWithdrawTarget(null)}
        onConfirm={() => {
          if (withdrawTarget) {
            void withdrawMutation.mutateAsync(withdrawTarget.playerId);
          }
        }}
      />
    </details>
  );
}

function DrawSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const notify = useNotification();
  const registrationsQuery = useEditionRegistrations(edition.id);
  const groupsQuery = useEditionGroups(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);
  const snapshotsQuery = useDrawSnapshots(
    edition.id,
    edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS',
  );
  const matchesQuery = useEditionMatches(edition.id);

  const groupStageGroups = useMemo(
    () => (groupsQuery.data?.groups ?? []).filter((entry) => entry.group.phase === 'GROUP_STAGE'),
    [groupsQuery.data],
  );

  const playerCount = registrationsQuery.data?.length ?? 0;
  const drawWarning = getDrawReadinessWarning(playerCount, edition.rules);
  const hasDraw = (groupsQuery.data?.groups.length ?? 0) > 0;
  const hasMatches = (matchesQuery.data?.length ?? 0) > 0;
  const isDrawCollapsed = edition.status === 'FASE_COLOCACAO' || edition.status === 'ENCERRADA';

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const drawMutation = useMutation({
    mutationFn: () => executeDraw(edition.id),
    onSuccess: async () => {
      notify.success('Sorteio executado com sucesso.');
      await invalidateEditionQueries(queryClient, edition.id);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível executar o sorteio.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelDraw(edition.id),
    onSuccess: async () => {
      notify.success('Sorteio cancelado. Você pode executar novamente.');
      await invalidateEditionQueries(queryClient, edition.id);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível cancelar o sorteio.');
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateMatches(edition.id),
    onSuccess: async () => {
      notify.success('Partidas geradas com sucesso.');
      await invalidateEditionQueries(queryClient, edition.id);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível gerar as partidas.');
    },
  });

  const canDraw =
    !hasDraw && (edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS');
  const canCancel =
    isPlayerShuffleEnabled() && hasDraw && !hasMatches && edition.status === 'SORTEIO_PUBLICADO';
  const canGenerate = edition.status === 'SORTEIO_PUBLICADO' && hasDraw && !hasMatches;

  const sectionBody = (
    <>
      {canDraw ? (
        <>
          {drawWarning ? <Alert variant="warning">{drawWarning}</Alert> : null}
          <button
            type="button"
            disabled={drawMutation.isPending || drawWarning !== null}
            onClick={() => void drawMutation.mutateAsync()}
            className="w-full rounded-lg bg-header px-4 py-3 text-sm font-semibold text-header-foreground disabled:opacity-50"
          >
            {drawMutation.isPending ? 'Executando sorteio…' : 'Executar sorteio'}
          </button>
        </>
      ) : null}

      {hasDraw ? (
        <>
          <GroupsView groups={groupStageGroups} playerNames={playerNames} emptyVariant="draw" />
          {snapshotsQuery.data ? <DrawAuditPanel snapshots={snapshotsQuery.data} /> : null}
        </>
      ) : null}

      {canGenerate ? (
        <button
          type="button"
          disabled={generateMutation.isPending}
          onClick={() => void generateMutation.mutateAsync()}
          className="w-full rounded-lg bg-header px-4 py-3 text-sm font-semibold text-header-foreground disabled:opacity-50"
        >
          {generateMutation.isPending ? 'Gerando partidas…' : 'Gerar partidas'}
        </button>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          disabled={cancelMutation.isPending}
          onClick={() => void cancelMutation.mutateAsync()}
          className="w-full rounded-lg border border-rose-500 px-4 py-3 text-sm font-semibold text-rose-600 disabled:opacity-50"
        >
          {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar sorteio e refazer'}
        </button>
      ) : null}
    </>
  );

  if (isDrawCollapsed) {
    return (
      <details className="group rounded-xl bg-card p-4 shadow-sm">
        <summary className="mb-0 flex cursor-pointer list-none items-center justify-between text-sm font-bold uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
          <span>Grupos sorteados (fase de grupos)</span>
          <span aria-hidden className="text-[10px] transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="mt-4 space-y-4">{sectionBody}</div>
      </details>
    );
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">Grupos sorteados</h3>
      {sectionBody}
    </section>
  );
}

function ContestCorrectionCard({
  contest,
  playerNames,
  editionId,
}: {
  contest: ContestedMatch;
  playerNames: Map<string, string>;
  editionId: string;
}) {
  const queryClient = useQueryClient();
  const notify = useNotification();
  const match = contest.match;
  const playerOneId = getPlayerOneId(match);
  const playerTwoId = getPlayerTwoId(match);
  const [confirmedOfficial, setConfirmedOfficial] = useState(false);

  const correctMutation = useMutation({
    mutationFn: (
      payload: import('../../components/edition/MatchResultForm.js').MatchResultSubmitPayload,
    ) => {
      if (payload.outcome === 'WALKOVER') {
        return correctMatchResult(match.id, {
          outcome: 'WALKOVER',
          absentPlayerId: payload.absentPlayerId,
        });
      }

      return correctMatchResult(match.id, {
        outcome: 'PLAYED',
        setsWonByPlayerOne: payload.setsWonByReporter,
        setsWonByPlayerTwo: payload.setsWonByOpponent,
      });
    },
    onSuccess: async () => {
      notify.success('Resultado corrigido e oficializado. A classificação foi atualizada.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contestedMatches(editionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matches(editionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.standings(editionId) }),
      ]);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível corrigir o placar.');
    },
  });

  return (
    <article className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
      <p className="text-sm font-semibold text-foreground">
        {playerNames.get(playerOneId) ?? 'Jogador 1'} vs{' '}
        {playerNames.get(playerTwoId) ?? 'Jogador 2'}
      </p>
      <p className="mt-1 text-xs text-subtle">
        Placar contestado: {formatMatchScore(match.participants, playerOneId, playerTwoId)}
      </p>
      {contest.contestReason ? (
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium">Motivo:</span> {contest.contestReason}
        </p>
      ) : null}

      <div className="mt-4">
        <MatchResultForm
          organizerMode
          playerOneId={playerOneId}
          playerTwoId={playerTwoId}
          playerOneLabel={playerNames.get(playerOneId) ?? 'Jogador 1'}
          playerTwoLabel={playerNames.get(playerTwoId) ?? 'Jogador 2'}
          reporterLabel={playerNames.get(playerOneId) ?? 'Jogador 1'}
          opponentLabel={playerNames.get(playerTwoId) ?? 'Jogador 2'}
          opponentId={playerTwoId}
          disabled={!confirmedOfficial}
          pending={correctMutation.isPending}
          submitLabel="Oficializar resultado corrigido"
          onSubmit={(payload) => void correctMutation.mutateAsync(payload)}
        />
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={confirmedOfficial}
          onChange={(event) => setConfirmedOfficial(event.target.checked)}
          className="mt-1"
        />
        <span>Confirmo que o resultado corrigido é oficial e substitui o placar contestado.</span>
      </label>
    </article>
  );
}

function ContestsSection({ edition }: { edition: Edition }) {
  const contestsQuery = useContestedMatches(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const contests = contestsQuery.data ?? [];
  if (contests.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">Contestações</h3>
      <div className="space-y-4">
        {contests.map((contest) => (
          <ContestCorrectionCard
            key={contest.match.id}
            contest={contest}
            playerNames={playerNames}
            editionId={edition.id}
          />
        ))}
      </div>
    </section>
  );
}

function PlacementSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const notify = useNotification();
  const groupsQuery = useEditionGroups(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);

  const placementGroups = useMemo(
    () =>
      (groupsQuery.data?.groups ?? []).filter((entry) => entry.group.phase === 'PLACEMENT_STAGE'),
    [groupsQuery.data],
  );

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const publishMutation = useMutation({
    mutationFn: () => publishPlacementStage(edition.id),
    onSuccess: async () => {
      notify.success('Fase de colocação publicada.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matches(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizerActiveEditions() }),
      ]);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível publicar a fase de colocação.');
    },
  });

  if (edition.status !== 'FASE_COLOCACAO' || placementGroups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">Fase de colocação</h3>
      <p className="text-sm text-muted">
        Revise os grupos gerados automaticamente e publique para liberar as partidas de colocação.
      </p>
      <GroupsView groups={placementGroups} playerNames={playerNames} emptyVariant="placement" />
      <button
        type="button"
        disabled={publishMutation.isPending}
        onClick={() => void publishMutation.mutateAsync()}
        className="w-full rounded-lg bg-header px-4 py-3 text-sm font-semibold text-header-foreground disabled:opacity-50"
      >
        {publishMutation.isPending ? 'Publicando…' : 'Publicar fase de colocação'}
      </button>
    </section>
  );
}

function FinalizeSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const notify = useNotification();
  const groupsQuery = useEditionGroups(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);
  const finalPlacementsQuery = useFinalPlacements(edition.id, edition.status === 'ENCERRADA');

  const hasPlacementGroups =
    edition.status === 'FASE_COLOCACAO' &&
    (groupsQuery.data?.groups ?? []).some((entry) => entry.group.phase === 'PLACEMENT_STAGE');

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeEdition(edition.id),
    onSuccess: async () => {
      notify.success('Edição encerrada com sucesso.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.finalPlacements(edition.id) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.championshipRanking(edition.championshipId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.championshipRoster(edition.championshipId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.championshipEditions(edition.championshipId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizerActiveEditions() }),
      ]);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível encerrar a edição.');
    },
  });

  if (edition.status === 'ENCERRADA') {
    return (
      <section className="space-y-4 rounded-xl bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">
          Classificação final
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-subtle">
              <th className="py-2">Pos.</th>
              <th className="py-2">Jogador</th>
              <th className="py-2 text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {(finalPlacementsQuery.data ?? []).map((placement) => (
              <tr key={placement.id} className="border-b border-line">
                <td className="py-2 font-semibold">{placement.position}º</td>
                <td className="py-2">
                  {playerNames.get(placement.playerId) ?? placement.playerId}
                </td>
                <td className="py-2 text-right">{placement.pointsAwarded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS') {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">Encerramento</h3>
      <p className="text-sm text-muted">
        {edition.status === 'FASE_COLOCACAO' && !hasPlacementGroups
          ? 'Fase de grupos concluída. Não há disputas de colocação — as posições finais já estão definidas pela classificação dos grupos. Encerre a edição para registrar a classificação final e atribuir pontos aos jogadores.'
          : 'Encerre a edição para registrar a classificação final das partidas e atribuir pontos aos jogadores.'}
      </p>
      <button
        type="button"
        disabled={finalizeMutation.isPending}
        onClick={() => void finalizeMutation.mutateAsync()}
        className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {finalizeMutation.isPending ? 'Encerrando…' : 'Encerrar edição'}
      </button>
    </section>
  );
}

export function OrganizerEditionPage() {
  const { editionId } = useParams<{ editionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotification();
  const editionQuery = useEdition(editionId);
  const registrationsQuery = useEditionRegistrations(editionId);
  const groupsQuery = useEditionGroups(editionId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEditionSse(editionId);

  const deleteMutation = useMutation({
    mutationFn: () => deleteEdition(editionId!),
    onSuccess: async (result) => {
      setIsDeleteDialogOpen(false);
      await purgeEditionLocalState(editionId!);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.championshipEditions(result.championshipId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizerActiveEditions() }),
      ]);
      void navigate(`/organizador/campeonato/${result.championshipId}`);
    },
    onError: (error) => {
      notifyApiError(notify, error, 'Não foi possível excluir a edição.');
      setIsDeleteDialogOpen(false);
    },
  });

  if (editionQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando edição…</p>;
  }

  if (editionQuery.isError || !editionQuery.data) {
    return <Alert variant="danger">Edição não encontrada.</Alert>;
  }

  const edition = editionQuery.data;
  const placementGroupCount =
    edition.status === 'FASE_COLOCACAO'
      ? (groupsQuery.data?.groups ?? []).filter((entry) => entry.group.phase === 'PLACEMENT_STAGE')
          .length
      : undefined;
  const canDelete =
    (edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS') &&
    (registrationsQuery.data?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-header p-4 text-header-foreground">
        <Link
          className="text-xs text-header-foreground/70 underline"
          to={`/organizador/campeonato/${edition.championshipId}`}
        >
          ← {edition.championshipId ? 'Voltar ao campeonato' : 'Painel do organizador'}
        </Link>
        <h2 className="mt-2 text-lg font-bold">{formatEditionTitle(edition)}</h2>
        <p className="text-sm text-header-foreground/70">
          {formatEditionStatus(edition.status, { placementGroupCount })}
        </p>
        {edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS' ? (
          <Link
            to={`/organizador/edicao/${edition.id}/preparar`}
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Configurar edição (check-in e sorteio)
          </Link>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="mt-4 ml-0 inline-flex rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 sm:ml-3 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
          >
            Excluir edição
          </button>
        ) : null}
      </section>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Excluir edição"
        description={
          <>
            Tem certeza que deseja excluir <strong>{edition.name}</strong>? Esta ação não pode ser
            desfeita — você poderá criar uma nova edição em seguida.
          </>
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => void deleteMutation.mutateAsync()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />

      <RegistrationsSection edition={edition} />
      <EditionAccessSection
        editionId={edition.id}
        editionName={edition.name}
        editionStatus={edition.status}
      />
      <EditionTournamentOverview edition={edition} />
      <DrawSection edition={edition} />
      <ContestsSection edition={edition} />
      <PlacementSection edition={edition} />
      <FinalizeSection edition={edition} />
    </div>
  );
}
