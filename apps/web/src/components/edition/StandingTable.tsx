import type { EditionParticipant, Match, Standing } from '@clandestino/shared-contracts';

type StandingTableProps = {
  rows: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    detail?: string;
    setsWon: number;
    matchesWon?: number;
    matchesPlayed?: number;
  }>;
};

/** Statuses that count toward standings / matches played (mirrors tournament-engine). */
const COUNTED_MATCH_STATUSES = new Set<Match['status']>(['CONFIRMADA', 'CORRIGIDA']);

function formatMatchesPlayedDetail(count: number): string {
  return count === 1 ? '1 partida' : `${count} partidas`;
}

/**
 * Counts confirmed/corrected matches per player, optionally scoped to known groups.
 */
export function countMatchesPlayedByPlayer(
  matches: Array<Pick<Match, 'participants' | 'status' | 'groupId'>>,
  groupIds: Iterable<string> = [],
): Map<string, number> {
  const knownGroupIds = new Set(groupIds);
  const counts = new Map<string, number>();

  for (const match of matches) {
    if (knownGroupIds.size > 0 && !knownGroupIds.has(match.groupId)) {
      continue;
    }
    if (!COUNTED_MATCH_STATUSES.has(match.status)) {
      continue;
    }

    for (const participant of match.participants) {
      counts.set(participant.playerId, (counts.get(participant.playerId) ?? 0) + 1);
    }
  }

  return counts;
}

function rankClassName(rank: number): string {
  if (rank === 1) return 'text-amber-600';
  if (rank === 2) return 'text-subtle';
  if (rank === 3) return 'text-amber-900';
  return 'text-foreground';
}

export function StandingTable({ rows }: StandingTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-subtle">
        Classificação ainda não disponível.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm">
      <div className="grid grid-cols-[2rem_1fr_3rem] border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-subtle">
        <span>#</span>
        <span>Jogador</span>
        <span className="text-right">Sets</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.playerId}
          className="grid grid-cols-[2rem_1fr_3rem] items-center border-b border-line px-3 py-3 last:border-b-0"
        >
          <span className={`font-bold ${rankClassName(row.rank)}`}>{row.rank}</span>
          <div>
            <p className="text-sm text-foreground">{row.playerName}</p>
            {row.detail ? <p className="text-[11px] text-subtle">{row.detail}</p> : null}
          </div>
          <span className="text-right text-sm font-semibold text-foreground">{row.setsWon}</span>
        </div>
      ))}
    </div>
  );
}

type CombinedStandingInput = {
  /**
   * Standings retornados pelo servidor, agrupados por grupo. Pode incluir
   * grupos de mais de uma fase (fase de grupos + fase de colocação). Cada
   * jogador aparece em um grupo por fase, ou seja, pode ter várias entradas
   * — uma por fase em que jogou.
   */
  standings: Array<{ groupId: string; standings: Standing[] }>;
  /** IDs dos grupos conhecidos da edição. Usado apenas como validação
   *  defensiva: standings cujo `groupId` não bate com nenhum grupo são
   *  ignorados. Se vazio, aceita todos. */
  groupIds: Iterable<string>;
  playerNames: Map<string, string>;
  /**
   * Partidas da edição. O `detail` da linha mostra partidas jogadas
   * (CONFIRMADA/CORRIGIDA), não vitórias (`matchesWon`). Contagem deriva
   * das partidas para acompanhar confirmações em tempo real via sync.
   */
  matches: Array<Pick<Match, 'participants' | 'status' | 'groupId'>>;
};

/**
 * Consolida os standings de uma edição somando, por jogador, os valores
 * `setsWon`, `matchesWon` e `setDiff` registrados em cada fase
 * (fase de grupos + fase de colocação).
 *
 * Por que consolidar? O servidor mantém uma linha de `standing` por
 * (grupo, jogador): a mesma pessoa tem um registro no seu grupo da
 * fase de grupos e outro no seu grupo da fase de colocação. Renderizar
 * cada entrada como uma linha própria na tabela de "Classificação"
 * causa duplicação visível (12 linhas para 6 jogadores no cenário
 * típico). A "Classificação Final" oficial, exibida após encerrar a
 * edição, é calculada a partir de `final_placement` (uma linha por
 * jogador); esta função é apenas a prévia que combina as duas fases.
 *
 * A ordenação é por `setsWon` total (decrescente), com `matchesWon`
 * total como desempate e nome como último critério (estável).
 * O `detail` usa partidas jogadas (não vitórias).
 */
export function buildCombinedStandingsRows(
  input: CombinedStandingInput,
): StandingTableProps['rows'] {
  const knownGroupIds = new Set(input.groupIds);
  const matchesPlayedByPlayer = countMatchesPlayedByPlayer(input.matches, knownGroupIds);

  const aggregated = new Map<string, { setsWon: number; matchesWon: number; setDiff: number }>();

  for (const groupStanding of input.standings) {
    // Ignora silenciosamente standings cujo grupo não consta mais na
    // edição (defesa contra inconsistência de cache/offline).
    if (knownGroupIds.size > 0 && !knownGroupIds.has(groupStanding.groupId)) {
      continue;
    }

    for (const standing of groupStanding.standings) {
      const current = aggregated.get(standing.playerId) ?? {
        setsWon: 0,
        matchesWon: 0,
        setDiff: 0,
      };
      current.setsWon += standing.setsWon;
      current.matchesWon += standing.matchesWon;
      current.setDiff += standing.setDiff;
      aggregated.set(standing.playerId, current);
    }
  }

  return [...aggregated.entries()]
    .map(([playerId, totals]) => ({
      playerId,
      playerName: input.playerNames.get(playerId) ?? 'Jogador',
      setsWon: totals.setsWon,
      matchesWon: totals.matchesWon,
      matchesPlayed: matchesPlayedByPlayer.get(playerId) ?? 0,
    }))
    .sort((left, right) => {
      if (right.setsWon !== left.setsWon) {
        return right.setsWon - left.setsWon;
      }
      if ((right.matchesWon ?? 0) !== (left.matchesWon ?? 0)) {
        return (right.matchesWon ?? 0) - (left.matchesWon ?? 0);
      }
      return left.playerName.localeCompare(right.playerName, 'pt-BR');
    })
    .map((entry, index) => ({
      rank: index + 1,
      playerId: entry.playerId,
      playerName: entry.playerName,
      detail: formatMatchesPlayedDetail(entry.matchesPlayed),
      setsWon: entry.setsWon,
      matchesWon: entry.matchesWon,
      matchesPlayed: entry.matchesPlayed,
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
