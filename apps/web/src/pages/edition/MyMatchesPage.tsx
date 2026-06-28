import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { ContestDialog } from '../../components/edition/ContestDialog.js';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { MatchCard } from '../../components/edition/MatchCard.js';
import {
  useEditionGroups,
  useEditionParticipants,
  usePlayerMatches,
} from '../../hooks/use-edition-data.js';
import { confirmMatch, contestMatch } from '../../lib/edition-api.js';
import { groupMatchesByPhase } from '../../lib/match-utils.js';
import { queryKeys } from '../../lib/query-keys.js';
import type { PlayerOutletContext } from './RequirePlayerSession.js';

export function MyMatchesPage() {
  const { edition, editionId, session } = useOutletContext<PlayerOutletContext>();
  const queryClient = useQueryClient();
  const matchesQuery = usePlayerMatches(editionId, true);
  const groupsQuery = useEditionGroups(editionId);
  const participantsQuery = useEditionParticipants(editionId);
  const [contestMatchId, setContestMatchId] = useState<string | null>(null);

  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participantsQuery.data ?? []) {
      map.set(participant.playerId, participant.playerName);
    }
    return map;
  }, [participantsQuery.data]);

  const groupsById = useMemo(
    () => new Map((groupsQuery.data?.groups ?? []).map((entry) => [entry.group.id, entry.group])),
    [groupsQuery.data],
  );

  const myGroup = useMemo(() => {
    return (groupsQuery.data?.groups ?? []).find((entry) =>
      entry.players.some((player) => player.playerId === session.playerId),
    );
  }, [groupsQuery.data, session.playerId]);

  const groupedMatches = useMemo(() => {
    return groupMatchesByPhase(matchesQuery.data ?? [], groupsById);
  }, [matchesQuery.data, groupsById]);

  const confirmMutation = useMutation({
    mutationFn: (matchId: string) => confirmMatch(matchId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.matches(editionId, 'me') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.standings(editionId) });
    },
  });

  const contestMutation = useMutation({
    mutationFn: ({ matchId, reason }: { matchId: string; reason?: string }) =>
      contestMatch(matchId, reason ? { reason } : {}),
    onSuccess: async () => {
      setContestMatchId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.matches(editionId, 'me') });
    },
  });

  return (
    <div className="space-y-4">
      <EditionHeader
        edition={edition}
        subtitle={`${session.playerName ?? 'Jogador'} · ${myGroup?.group.name ?? 'Sem grupo'}`}
        badge={
          myGroup ? (
            <span className="rounded bg-header-foreground/10 px-2 py-1 text-[11px]">
              {myGroup.group.name}
            </span>
          ) : null
        }
      />

      {matchesQuery.isLoading ? <p className="text-sm text-subtle">Carregando partidas…</p> : null}

      {groupedMatches.length === 0 && !matchesQuery.isLoading ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-subtle">
          Nenhuma partida atribuída a você ainda.
        </p>
      ) : null}

      {groupedMatches.map((group) => (
        <section key={group.phase} className="space-y-2">
          <h2 className="px-1 text-[11px] font-bold uppercase tracking-wide text-subtle">
            {group.label}
          </h2>
          {group.matches.map((match) => {
            const opponentId = match.participants.find(
              (participant) => participant.playerId !== session.playerId,
            )?.playerId;

            return (
              <MatchCard
                key={match.id}
                match={match}
                playerId={session.playerId}
                opponentName={playerNames.get(opponentId ?? '') ?? 'Adversário'}
                editionId={editionId}
                onConfirm={(matchId) => confirmMutation.mutate(matchId)}
                onContest={setContestMatchId}
                confirming={confirmMutation.isPending || contestMutation.isPending}
              />
            );
          })}
        </section>
      ))}

      <ContestDialog
        open={contestMatchId !== null}
        onClose={() => setContestMatchId(null)}
        submitting={contestMutation.isPending}
        onSubmit={(reason) => {
          if (contestMatchId) {
            contestMutation.mutate({ matchId: contestMatchId, reason: reason || undefined });
          }
        }}
      />
    </div>
  );
}
