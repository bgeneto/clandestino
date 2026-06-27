import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { StandingTable, buildGroupStandingsRows } from '../../components/edition/StandingTable.js';
import {
  useEditionGroups,
  useEditionParticipants,
  useEditionStandings,
} from '../../hooks/use-edition-data.js';
import type { PlayerOutletContext } from './RequirePlayerSession.js';

export function PlayerStandingsPage() {
  const { edition, editionId, session } = useOutletContext<PlayerOutletContext>();
  const groupsQuery = useEditionGroups(editionId);
  const standingsQuery = useEditionStandings(editionId);
  const participantsQuery = useEditionParticipants(editionId);

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const myGroup = useMemo(() => {
    return (groupsQuery.data?.groups ?? []).find((entry) =>
      entry.players.some((player) => player.playerId === session.playerId),
    );
  }, [groupsQuery.data, session.playerId]);

  const rows = useMemo(() => {
    if (!myGroup || !standingsQuery.data) {
      return [];
    }

    const groupStanding = standingsQuery.data.groups.find(
      (entry) => entry.groupId === myGroup.group.id,
    );

    if (!groupStanding) {
      return [];
    }

    return buildGroupStandingsRows({
      groupId: myGroup.group.id,
      standings: groupStanding.standings,
      playerNames,
      participants: participantsQuery.data ?? [],
    });
  }, [myGroup, standingsQuery.data, playerNames, participantsQuery.data]);

  return (
    <div className="space-y-4">
      <EditionHeader
        edition={edition}
        subtitle={`Classificação · ${myGroup?.group.name ?? 'Grupo'}`}
      />
      <StandingTable rows={rows} />
    </div>
  );
}
