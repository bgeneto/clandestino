import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContestedMatch, Edition, Match } from '@clandestino/shared-contracts';
import { GroupsView } from '../../components/edition/GroupsView.js';
import { ScoreCounter } from '../../components/edition/ScoreCounter.js';
import { DrawAuditPanel } from '../../components/organizer/DrawAuditPanel.js';
import { EditionQrCode } from '../../components/organizer/EditionQrCode.js';
import {
  useContestedMatches,
  useDrawSnapshots,
  useEditionQr,
  useEditionRegistrations,
  useFinalPlacements,
  usePlayers,
} from '../../hooks/use-organizer-data.js';
import {
  useEditionGroups,
  useEditionMatches,
  useEditionParticipants,
} from '../../hooks/use-edition-data.js';
import { useEdition } from '../../hooks/use-edition.js';
import { useEditionSse } from '../../hooks/use-edition-sse.js';
import { ApiError } from '../../lib/api-client.js';
import { getDrawReadinessWarning } from '../../lib/draw-utils.js';
import { formatEditionStatus, formatEditionTitle, formatMatchScore } from '../../lib/format.js';
import { validateScoreInput } from '../../lib/match-utils.js';
import {
  cancelDraw,
  correctMatchResult,
  executeDraw,
  finalizeEdition,
  generateMatches,
  publishPlacementStage,
  registerPlayer,
} from '../../lib/organizer-api.js';
import { queryKeys } from '../../lib/query-keys.js';

function getPlayerOneId(match: Match): string {
  return match.participants[0]?.playerId ?? '';
}

function getPlayerTwoId(match: Match): string {
  return match.participants[1]?.playerId ?? '';
}

function RegistrationsSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const playersQuery = usePlayers();
  const registrationsQuery = useEditionRegistrations(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const registeredIds = useMemo(
    () => new Set((registrationsQuery.data ?? []).map((entry) => entry.playerId)),
    [registrationsQuery.data],
  );

  const filteredPlayers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const players = playersQuery.data ?? [];
    if (!normalized) {
      return players.filter((player) => !registeredIds.has(player.id)).slice(0, 8);
    }

    return players
      .filter(
        (player) => !registeredIds.has(player.id) && player.name.toLowerCase().includes(normalized),
      )
      .slice(0, 8);
  }, [playersQuery.data, registeredIds, search]);

  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const registerMutation = useMutation({
    mutationFn: (playerId: string) => registerPlayer(edition.id, { playerId }),
    onSuccess: async () => {
      setFeedback('Jogador inscrito.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.registrations(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.participants(edition.id) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível inscrever o jogador.',
      );
    },
  });

  const canRegister = edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS';

  return (
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Inscrições</h3>

      {canRegister ? (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogador no cadastro…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="space-y-2">
            {filteredPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                disabled={registerMutation.isPending}
                onClick={() => void registerMutation.mutateAsync(player.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>{player.name}</span>
                <span className="text-xs text-brand">Inscrever</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
          Inscritos ({registrationsQuery.data?.length ?? 0})
        </p>
        <ul className="space-y-2">
          {(participantsQuery.data ?? []).map((participant) => {
            const hasDrawSeeds = (participantsQuery.data ?? []).some((entry) => entry.isSeed);
            const isSeed = hasDrawSeeds
              ? participant.isSeed
              : participant.rankPosition <= edition.rules.protectedSeedCount;

            return (
              <li
                key={participant.playerId}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span>{participantNames.get(participant.playerId) ?? participant.playerName}</span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{participant.rankPosition}º</span>
                  <span>{participant.accumulatedPoints} pts</span>
                  {isSeed ? (
                    <span className="rounded-full bg-amber-300 px-2 py-0.5 font-bold text-slate-800">
                      SEED
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}
    </section>
  );
}

function DrawSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const registrationsQuery = useEditionRegistrations(edition.id);
  const groupsQuery = useEditionGroups(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);
  const snapshotsQuery = useDrawSnapshots(
    edition.id,
    edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS',
  );
  const qrQuery = useEditionQr(
    edition.id,
    edition.status === 'SORTEIO_PUBLICADO' || edition.status === 'EM_ANDAMENTO',
  );
  const matchesQuery = useEditionMatches(edition.id);
  const [feedback, setFeedback] = useState<string | null>(null);

  const playerCount = registrationsQuery.data?.length ?? 0;
  const drawWarning = getDrawReadinessWarning(playerCount, edition.rules);
  const hasDraw = (groupsQuery.data?.groups.length ?? 0) > 0;
  const hasMatches = (matchesQuery.data?.length ?? 0) > 0;

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
      setFeedback('Sorteio executado com sucesso.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.participants(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drawSnapshots(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível executar o sorteio.',
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelDraw(edition.id),
    onSuccess: async () => {
      setFeedback('Sorteio cancelado. Você pode executar novamente.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drawSnapshots(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível cancelar o sorteio.',
      );
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateMatches(edition.id),
    onSuccess: async () => {
      setFeedback('Partidas geradas com sucesso.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.matches(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível gerar as partidas.',
      );
    },
  });

  const canDraw =
    !hasDraw && (edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS');
  const canCancel = hasDraw && !hasMatches && edition.status === 'SORTEIO_PUBLICADO';
  const canGenerate = edition.status === 'SORTEIO_PUBLICADO' && hasDraw && !hasMatches;

  return (
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Sorteio e grupos</h3>

      {canDraw ? (
        <>
          {drawWarning ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {drawWarning}
            </p>
          ) : null}
          <button
            type="button"
            disabled={drawMutation.isPending || drawWarning !== null}
            onClick={() => void drawMutation.mutateAsync()}
            className="w-full rounded-lg bg-[#1a1a2e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {drawMutation.isPending ? 'Executando sorteio…' : 'Executar sorteio'}
          </button>
        </>
      ) : null}

      {hasDraw ? (
        <>
          <GroupsView groups={groupsQuery.data?.groups ?? []} playerNames={playerNames} />
          {snapshotsQuery.data ? <DrawAuditPanel snapshots={snapshotsQuery.data} /> : null}
        </>
      ) : null}

      {qrQuery.data ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="mb-3 text-center text-sm font-bold uppercase text-slate-500">
            QR Code da edição
          </h4>
          <EditionQrCode url={qrQuery.data.url} label="Exiba para os jogadores entrarem" />
        </div>
      ) : null}

      {canGenerate ? (
        <button
          type="button"
          disabled={generateMutation.isPending}
          onClick={() => void generateMutation.mutateAsync()}
          className="w-full rounded-lg bg-[#1a1a2e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
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

      {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}
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
  const match = contest.match;
  const playerOneId = getPlayerOneId(match);
  const playerTwoId = getPlayerTwoId(match);
  const [playerOneSets, setPlayerOneSets] = useState(
    match.participants.find((entry) => entry.playerId === playerOneId)?.setsWon ?? 0,
  );
  const [playerTwoSets, setPlayerTwoSets] = useState(
    match.participants.find((entry) => entry.playerId === playerTwoId)?.setsWon ?? 0,
  );
  const [confirmedOfficial, setConfirmedOfficial] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const validation = validateScoreInput(playerOneSets, playerTwoSets, match.bestOf);

  const correctMutation = useMutation({
    mutationFn: () =>
      correctMatchResult(match.id, {
        setsWonByPlayerOne: playerOneSets,
        setsWonByPlayerTwo: playerTwoSets,
      }),
    onSuccess: async () => {
      setFeedback('Resultado corrigido e oficializado. A classificação foi atualizada.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contestedMatches(editionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matches(editionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.standings(editionId) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível corrigir o placar.',
      );
    },
  });

  return (
    <article className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
      <p className="text-sm font-semibold text-slate-800">
        {playerNames.get(playerOneId) ?? 'Jogador 1'} vs{' '}
        {playerNames.get(playerTwoId) ?? 'Jogador 2'}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Placar contestado: {formatMatchScore(match.participants, playerOneId, playerTwoId)}
      </p>
      {contest.contestReason ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">Motivo:</span> {contest.contestReason}
        </p>
      ) : null}

      <div className="mt-4 flex gap-4">
        <ScoreCounter
          label={playerNames.get(playerOneId) ?? 'Jogador 1'}
          value={playerOneSets}
          max={match.bestOf}
          onIncrement={() => setPlayerOneSets((value) => Math.min(value + 1, match.bestOf))}
          onDecrement={() => setPlayerOneSets((value) => Math.max(value - 1, 0))}
        />
        <ScoreCounter
          label={playerNames.get(playerTwoId) ?? 'Jogador 2'}
          value={playerTwoSets}
          max={match.bestOf}
          onIncrement={() => setPlayerTwoSets((value) => Math.min(value + 1, match.bestOf))}
          onDecrement={() => setPlayerTwoSets((value) => Math.max(value - 1, 0))}
        />
      </div>

      {!validation.valid ? <p className="mt-3 text-sm text-rose-700">{validation.reason}</p> : null}

      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={confirmedOfficial}
          onChange={(event) => setConfirmedOfficial(event.target.checked)}
          className="mt-1"
        />
        <span>Confirmo que o resultado corrigido é oficial e substitui o placar contestado.</span>
      </label>

      <button
        type="button"
        disabled={!validation.valid || !confirmedOfficial || correctMutation.isPending}
        onClick={() => void correctMutation.mutateAsync()}
        className="mt-4 w-full rounded-lg bg-[#1a1a2e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {correctMutation.isPending ? 'Salvando…' : 'Oficializar resultado corrigido'}
      </button>

      {feedback ? <p className="mt-3 text-sm text-slate-600">{feedback}</p> : null}
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
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Contestações</h3>
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
  const groupsQuery = useEditionGroups(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);
  const [feedback, setFeedback] = useState<string | null>(null);

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
      setFeedback('Fase de colocação publicada.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matches(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível publicar a fase de colocação.',
      );
    },
  });

  if (edition.status !== 'FASE_COLOCACAO') {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Fase de colocação
      </h3>
      <p className="text-sm text-slate-600">Revise os grupos gerados automaticamente e publique.</p>
      <GroupsView groups={placementGroups} playerNames={playerNames} />
      <button
        type="button"
        disabled={publishMutation.isPending || placementGroups.length === 0}
        onClick={() => void publishMutation.mutateAsync()}
        className="w-full rounded-lg bg-[#1a1a2e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {publishMutation.isPending ? 'Publicando…' : 'Publicar fase de colocação'}
      </button>
      {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}
    </section>
  );
}

function FinalizeSection({ edition }: { edition: Edition }) {
  const queryClient = useQueryClient();
  const participantsQuery = useEditionParticipants(edition.id);
  const finalPlacementsQuery = useFinalPlacements(edition.id, edition.status === 'ENCERRADA');
  const [feedback, setFeedback] = useState<string | null>(null);

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
      setFeedback('Edição encerrada com sucesso.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.edition(edition.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.finalPlacements(edition.id) }),
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível encerrar a edição.',
      );
    },
  });

  if (edition.status === 'ENCERRADA') {
    return (
      <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Classificação final
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Pos.</th>
              <th className="py-2">Jogador</th>
              <th className="py-2 text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {(finalPlacementsQuery.data ?? []).map((placement) => (
              <tr key={placement.id} className="border-b border-slate-100">
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
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Encerramento</h3>
      <p className="text-sm text-slate-600">
        Encerre a edição para registrar a classificação final e atribuir pontos da temporada.
      </p>
      <button
        type="button"
        disabled={finalizeMutation.isPending}
        onClick={() => void finalizeMutation.mutateAsync()}
        className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {finalizeMutation.isPending ? 'Encerrando…' : 'Encerrar edição'}
      </button>
      {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}
    </section>
  );
}

export function OrganizerEditionPage() {
  const { editionId } = useParams<{ editionId: string }>();
  const editionQuery = useEdition(editionId);

  useEditionSse(editionId);

  if (editionQuery.isLoading) {
    return <p className="text-sm text-slate-400">Carregando edição…</p>;
  }

  if (editionQuery.isError || !editionQuery.data) {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        Edição não encontrada.
      </section>
    );
  }

  const edition = editionQuery.data;

  return (
    <div className="-mx-4 -my-6 min-h-full flex-1 space-y-4 bg-slate-100 px-4 py-6 text-slate-900">
      <section className="rounded-xl bg-[#1a1a2e] p-4 text-white">
        <Link className="text-xs text-white/70 underline" to="/organizador/painel">
          ← Painel do organizador
        </Link>
        <h2 className="mt-2 text-lg font-bold">{formatEditionTitle(edition)}</h2>
        <p className="text-sm text-white/70">{formatEditionStatus(edition.status)}</p>
      </section>

      <RegistrationsSection edition={edition} />
      <DrawSection edition={edition} />
      <ContestsSection edition={edition} />
      <PlacementSection edition={edition} />
      <FinalizeSection edition={edition} />
    </div>
  );
}
