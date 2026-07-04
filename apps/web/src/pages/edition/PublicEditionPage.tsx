import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { GroupsView } from '../../components/edition/GroupsView.js';
import { PublicMatchRow } from '../../components/edition/MatchCard.js';
import { PublicTabs } from '../../components/edition/PublicTabs.js';
import {
  StandingTable,
  buildCombinedStandingsRows,
} from '../../components/edition/StandingTable.js';
import {
  useEditionGroups,
  useEditionMatches,
  useEditionParticipants,
  useEditionStandings,
} from '../../hooks/use-edition-data.js';
import type { EditionOutletContext } from './EditionLayout.js';

export function PublicEditionPage() {
  const { edition, editionId } = useOutletContext<EditionOutletContext>();
  const [activeTab, setActiveTab] = useState<'standings' | 'groups' | 'matches'>('standings');

  const groupsQuery = useEditionGroups(editionId);
  const standingsQuery = useEditionStandings(editionId);
  const matchesQuery = useEditionMatches(editionId);
  const participantsQuery = useEditionParticipants(editionId);

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const groupNameById = useMemo(
    () =>
      new Map((groupsQuery.data?.groups ?? []).map((entry) => [entry.group.id, entry.group.name])),
    [groupsQuery.data],
  );

  const standingRows = useMemo(() => {
    if (!standingsQuery.data || !groupsQuery.data) {
      return [];
    }

    return buildCombinedStandingsRows({
      standings: standingsQuery.data.groups,
      groupIds: groupsQuery.data.groups.map((entry) => entry.group.id),
      playerNames,
    });
  }, [standingsQuery.data, groupsQuery.data, playerNames]);

  const isPreparing = edition.status === 'RASCUNHO' || edition.status === 'INSCRICOES_ABERTAS';

  return (
    <div className="space-y-4 pb-6">
      <EditionHeader
        edition={edition}
        live={!isPreparing}
        subtitle={isPreparing ? 'Edição em preparação' : 'Acompanhe o torneio ao vivo'}
      />

      <PublicTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'standings' ? <StandingTable rows={standingRows} /> : null}

      {activeTab === 'groups' ? (
        <GroupsView groups={groupsQuery.data?.groups ?? []} playerNames={playerNames} />
      ) : null}

      {activeTab === 'matches' ? (
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          {(matchesQuery.data ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-subtle">Nenhuma partida publicada.</p>
          ) : (
            (matchesQuery.data ?? []).map((match) => (
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
    </div>
  );
}
