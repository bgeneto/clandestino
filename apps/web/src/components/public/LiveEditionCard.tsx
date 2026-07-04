import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { EditionSummary, Match } from '@clandestino/shared-contracts';
import { PublicMatchRow } from '../edition/MatchCard.js';
import { StandingTable, buildCombinedStandingsRows } from '../edition/StandingTable.js';
import {
  useEditionGroups,
  useEditionMatches,
  useEditionParticipants,
  useEditionStandings,
} from '../../hooks/use-edition-data.js';
import { useEditionSync } from '../../hooks/use-edition-sync.js';
import { formatEditionDate, formatEditionStatus } from '../../lib/format.js';
import { isLiveEdition } from '../../lib/public-editions.js';

const PREVIEW_STANDINGS_LIMIT = 3;
const PREVIEW_MATCHES_LIMIT = 3;

const MATCH_PREVIEW_PRIORITY: Record<Match['status'], number> = {
  AGUARDANDO_CONFIRMACAO: 0,
  CONTESTADA: 1,
  CONFIRMADA: 2,
  CORRIGIDA: 3,
  AGENDADA: 4,
  CANCELADA: 5,
};

function selectPreviewMatches(matches: Match[]): Match[] {
  return [...matches]
    .sort((left, right) => {
      const priorityDiff =
        MATCH_PREVIEW_PRIORITY[left.status] - MATCH_PREVIEW_PRIORITY[right.status];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .slice(0, PREVIEW_MATCHES_LIMIT);
}

type LiveEditionCardProps = {
  edition: EditionSummary;
  enableSse?: boolean;
};

export function LiveEditionCard({ edition, enableSse = false }: LiveEditionCardProps) {
  const editionId = edition.id;
  const live = isLiveEdition(edition.status);

  useEditionSync(editionId, enableSse);

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
    }).slice(0, PREVIEW_STANDINGS_LIMIT);
  }, [standingsQuery.data, groupsQuery.data, playerNames]);

  const previewMatches = useMemo(
    () => selectPreviewMatches(matchesQuery.data ?? []),
    [matchesQuery.data],
  );

  return (
    <article className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {edition.name}
            {live ? (
              <span className="ml-2 inline-flex rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Ao vivo
              </span>
            ) : null}
          </h3>
          <p className="mt-1 text-sm text-subtle">
            {formatEditionDate(edition.date)} · {formatEditionStatus(edition.status)}
          </p>
        </div>
      </div>

      {standingRows.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            Classificação
          </p>
          <StandingTable rows={standingRows} />
        </div>
      ) : null}

      {previewMatches.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl bg-card-muted shadow-sm">
          <p className="border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            Partidas
          </p>
          {previewMatches.map((match) => (
            <PublicMatchRow
              key={match.id}
              match={match}
              playerNames={playerNames}
              groupName={groupNameById.get(match.groupId) ?? 'Grupo'}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-subtle">Nenhuma partida publicada.</p>
      )}

      <Link
        to={`/edicao/${editionId}`}
        className="mt-4 inline-flex text-sm font-medium text-brand underline-offset-2 hover:underline"
      >
        Acompanhar edição →
      </Link>
    </article>
  );
}
