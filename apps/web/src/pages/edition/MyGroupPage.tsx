import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { GroupsView } from '../../components/edition/GroupsView.js';
import { useEditionGroups, useEditionParticipants } from '../../hooks/use-edition-data.js';
import type { PlayerOutletContext } from './RequirePlayerSession.js';

export function MyGroupPage() {
  const { edition, editionId, session } = useOutletContext<PlayerOutletContext>();
  const groupsQuery = useEditionGroups(editionId);
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

  return (
    <div className="space-y-4">
      <EditionHeader
        edition={edition}
        subtitle={session.playerName ?? 'Jogador'}
        badge={
          myGroup ? (
            <span className="rounded bg-header-foreground/10 px-2 py-1 text-[11px]">
              {myGroup.group.name}
            </span>
          ) : null
        }
      />

      {myGroup ? (
        <GroupsView
          groups={[myGroup]}
          playerNames={playerNames}
          highlightPlayerId={session.playerId}
        />
      ) : (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-subtle">
          Você ainda não foi alocado em um grupo.
        </p>
      )}
    </div>
  );
}
