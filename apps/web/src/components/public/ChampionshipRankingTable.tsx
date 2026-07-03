import type { ChampionshipRankingEntry } from '@clandestino/shared-contracts';

type ChampionshipRankingTableProps = {
  ranking: ChampionshipRankingEntry[];
  limit?: number;
  emptyMessage?: string;
};

export function ChampionshipRankingTable({
  ranking,
  limit,
  emptyMessage = 'Nenhuma pontuação registrada ainda.',
}: ChampionshipRankingTableProps) {
  const rows = limit === undefined ? ranking : ranking.slice(0, limit);

  if (rows.length === 0) {
    return <p className="text-sm text-subtle">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-card-muted text-subtle">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Jogador</th>
            <th className="px-3 py-2">Pontos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.playerId} className="border-t border-line">
              <td className="px-3 py-2 text-subtle">{entry.rank}</td>
              <td className="px-3 py-2 text-foreground">{entry.playerName}</td>
              <td className="px-3 py-2 text-muted">{entry.accumulatedPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
