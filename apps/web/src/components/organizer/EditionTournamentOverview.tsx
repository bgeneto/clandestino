import { useMemo, useState } from 'react';
import type { Edition } from '@clandestino/shared-contracts';
import { PublicMatchRow } from '../edition/MatchCard.js';
import { StandingTable, buildCombinedStandingsRows } from '../edition/StandingTable.js';
import {
  useEditionGroups,
  useEditionMatches,
  useEditionParticipants,
  useEditionStandings,
} from '../../hooks/use-edition-data.js';
import { Alert } from '../ui/Alert.js';
import {
  GROUP_STAGE_PHASE,
  PLACEMENT_STAGE_PHASE,
  buildGroupsById,
  countPhaseMatchProgress,
  filterMatchesByPhase,
  formatPhaseMatchProgress,
} from '../../lib/edition-progress.js';

type EditionTournamentOverviewProps = {
  edition: Edition;
};

export function EditionTournamentOverview({ edition }: EditionTournamentOverviewProps) {
  const [activeTab, setActiveTab] = useState<'standings' | 'matches'>('standings');
  const groupsQuery = useEditionGroups(edition.id);
  const standingsQuery = useEditionStandings(edition.id);
  const matchesQuery = useEditionMatches(edition.id);
  const participantsQuery = useEditionParticipants(edition.id);

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const groups = groupsQuery.data?.groups ?? [];
  const groupsById = useMemo(() => buildGroupsById(groups), [groups]);
  const matches = matchesQuery.data ?? [];

  const placementGroupCount = useMemo(
    () => groups.filter((entry) => entry.group.phase === PLACEMENT_STAGE_PHASE).length,
    [groups],
  );

  const groupStageProgress = useMemo(
    () => countPhaseMatchProgress(matches, groupsById, GROUP_STAGE_PHASE),
    [matches, groupsById],
  );

  const placementProgress = useMemo(
    () => countPhaseMatchProgress(matches, groupsById, PLACEMENT_STAGE_PHASE),
    [matches, groupsById],
  );

  const progressMessage = useMemo(() => {
    if (edition.status === 'FASE_COLOCACAO') {
      if (placementGroupCount === 0) {
        return 'Fase de grupos concluída — as posições finais já estão definidas. Próximo passo: encerrar a edição.';
      }

      return 'Fase de grupos concluída — revise os grupos de colocação abaixo e publique.';
    }

    if (placementProgress.total > 0) {
      return formatPhaseMatchProgress(
        'colocação',
        placementProgress.confirmed,
        placementProgress.total,
      );
    }

    if (groupStageProgress.total > 0) {
      return formatPhaseMatchProgress(
        'grupos',
        groupStageProgress.confirmed,
        groupStageProgress.total,
      );
    }

    return null;
  }, [edition.status, placementGroupCount, groupStageProgress, placementProgress]);

  const standingRows = useMemo(() => {
    if (!standingsQuery.data || groups.length === 0) {
      return [];
    }

    // Consolida os standings de TODAS as fases (fase de grupos + fase de
    // colocação) em uma linha por jogador, somando setsWon/matchesWon.
    // O detail mostra partidas jogadas (CONFIRMADA/CORRIGIDA), derivadas
    // das matches para acompanhar confirmações em tempo real.
    // A "Classificação Final" oficial (uma linha por jogador, baseada em
    // `final_placement`) só aparece após encerrar a edição; esta prévia
    // evita a duplicação visível (ex.: 12 linhas para 6 jogadores) que
    // ocorria ao renderizar cada `standing` por grupo/fase.
    return buildCombinedStandingsRows({
      standings: standingsQuery.data.groups,
      groupIds: groups.map((entry) => entry.group.id),
      playerNames,
      matches,
    });
  }, [standingsQuery.data, groups, playerNames, matches]);

  const groupNameById = useMemo(
    () => new Map(groups.map((entry) => [entry.group.id, entry.group.name])),
    [groups],
  );

  const visibleMatches = useMemo(() => {
    if (edition.status === 'FASE_COLOCACAO' && placementGroupCount === 0) {
      return filterMatchesByPhase(matches, groupsById, GROUP_STAGE_PHASE);
    }

    if (placementProgress.total > 0) {
      return filterMatchesByPhase(matches, groupsById, PLACEMENT_STAGE_PHASE);
    }

    return filterMatchesByPhase(matches, groupsById, GROUP_STAGE_PHASE);
  }, [edition.status, placementGroupCount, matches, groupsById, placementProgress.total]);

  if (edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS') {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">
        Andamento do torneio
      </h3>

      {progressMessage ? <Alert variant="info">{progressMessage}</Alert> : null}

      <div className="flex rounded-lg border border-line bg-card-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('standings')}
          className={[
            'flex-1 rounded-md px-3 py-2 font-semibold transition',
            activeTab === 'standings' ? 'bg-card text-foreground shadow-sm' : 'text-subtle',
          ].join(' ')}
        >
          Classificação
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={[
            'flex-1 rounded-md px-3 py-2 font-semibold transition',
            activeTab === 'matches' ? 'bg-card text-foreground shadow-sm' : 'text-subtle',
          ].join(' ')}
        >
          Partidas
        </button>
      </div>

      {activeTab === 'standings' ? <StandingTable rows={standingRows} /> : null}

      {activeTab === 'matches' ? (
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          {visibleMatches.length === 0 ? (
            <p className="p-6 text-center text-sm text-subtle">Nenhuma partida publicada.</p>
          ) : (
            visibleMatches.map((match) => (
              <PublicMatchRow
                key={match.id}
                match={match}
                playerNames={playerNames}
                groupName={groupNameById.get(match.groupId) ?? 'Grupo'}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
