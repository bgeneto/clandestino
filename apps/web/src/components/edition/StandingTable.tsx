import type { EditionParticipant, GroupWithPlayers, Standing } from '@clandestino/shared-contracts';

type StandingTableProps = {
  rows: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    detail?: string;
    setsWon: number;
    matchesWon?: number;
  }>;
};

function rankClassName(rank: number): string {
  if (rank === 1) return 'text-amber-600';
  if (rank === 2) return 'text-slate-500';
  if (rank === 3) return 'text-amber-900';
  return 'text-[#1a1a2e]';
}

export function StandingTable({ rows }: StandingTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">
        Classificação ainda não disponível.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="grid grid-cols-[2rem_1fr_3rem] border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        <span>#</span>
        <span>Jogador</span>
        <span className="text-right">Sets</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.playerId}
          className="grid grid-cols-[2rem_1fr_3rem] items-center border-b border-slate-50 px-3 py-3 last:border-b-0"
        >
          <span className={`font-bold ${rankClassName(row.rank)}`}>{row.rank}</span>
          <div>
            <p className="text-sm text-slate-900">{row.playerName}</p>
            {row.detail ? <p className="text-[11px] text-slate-400">{row.detail}</p> : null}
          </div>
          <span className="text-right text-sm font-semibold text-slate-900">{row.setsWon}</span>
        </div>
      ))}
    </div>
  );
}

export function buildCombinedStandingsRows(input: {
  standings: Array<{ groupId: string; standings: Standing[] }>;
  groups: GroupWithPlayers[];
  playerNames: Map<string, string>;
}): StandingTableProps['rows'] {
  const groupNameById = new Map(input.groups.map((entry) => [entry.group.id, entry.group.name]));

  const combined = input.standings.flatMap((groupStanding) =>
    groupStanding.standings.map((standing) => ({
      playerId: standing.playerId,
      playerName: input.playerNames.get(standing.playerId) ?? 'Jogador',
      setsWon: standing.setsWon,
      matchesWon: standing.matchesWon,
      groupName: groupNameById.get(groupStanding.groupId) ?? '',
    })),
  );

  return combined
    .sort((left, right) => {
      if (right.setsWon !== left.setsWon) {
        return right.setsWon - left.setsWon;
      }

      return (right.matchesWon ?? 0) - (left.matchesWon ?? 0);
    })
    .map((entry, index) => ({
      rank: index + 1,
      playerId: entry.playerId,
      playerName: entry.playerName,
      detail: entry.groupName
        ? `${entry.groupName} · ${entry.matchesWon ?? 0} partidas`
        : undefined,
      setsWon: entry.setsWon,
      matchesWon: entry.matchesWon,
    }));
}

export function buildGroupStandingsRows(input: {
  groupId: string;
  standings: Standing[];
  playerNames: Map<string, string>;
  participants: EditionParticipant[];
}): StandingTableProps['rows'] {
  return [...input.standings]
    .sort((left, right) => left.rankInGroup - right.rankInGroup)
    .map((standing) => ({
      rank: standing.rankInGroup,
      playerId: standing.playerId,
      playerName: input.playerNames.get(standing.playerId) ?? 'Jogador',
      setsWon: standing.setsWon,
      matchesWon: standing.matchesWon,
      detail: input.participants.find((participant) => participant.playerId === standing.playerId)
        ?.isSeed
        ? 'SEED'
        : undefined,
    }));
}
