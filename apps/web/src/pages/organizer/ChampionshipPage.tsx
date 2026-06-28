import { Link, useParams } from 'react-router-dom';
import {
  useChampionship,
  useChampionshipEditions,
  useChampionshipRanking,
} from '../../hooks/use-organizer-data.js';
import { formatEditionDate, formatEditionStatus } from '../../lib/format.js';
import { Alert } from '../../components/ui/Alert.js';

export function ChampionshipPage() {
  const { championshipId } = useParams<{ championshipId: string }>();
  const championshipQuery = useChampionship(championshipId);
  const editionsQuery = useChampionshipEditions(championshipId);
  const rankingQuery = useChampionshipRanking(championshipId);

  if (championshipQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando campeonato…</p>;
  }

  if (championshipQuery.isError || !championshipQuery.data) {
    return <Alert variant="danger">Campeonato não encontrado.</Alert>;
  }

  const championship = championshipQuery.data;
  const editions = editionsQuery.data ?? [];
  const ranking = rankingQuery.data ?? [];
  const activeEditions = editions.filter((edition) => edition.status !== 'ENCERRADA');

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <Link className="text-sm text-subtle underline" to="/organizador/painel">
          ← Voltar ao painel
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-foreground">{championship.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {activeEditions.length} edição(ões) em andamento · {ranking.length} jogadores no ranking
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to={`/organizador/campeonato/${championship.id}/edicao/nova`}
          className="rounded-2xl border border-line bg-card px-5 py-4 text-foreground transition hover:border-brand"
        >
          <p className="font-medium">Nova edição</p>
          <p className="mt-1 text-sm text-subtle">Criar rodada neste campeonato</p>
        </Link>
        <Link
          to={`/organizador/campeonato/${championship.id}/importar`}
          className="rounded-2xl border border-line bg-card px-5 py-4 text-foreground transition hover:border-brand"
        >
          <p className="font-medium">Importar pontuação CSV</p>
          <p className="mt-1 text-sm text-subtle">Atualizar ranking acumulado</p>
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Ranking acumulado</h3>
        {rankingQuery.isLoading ? (
          <p className="mt-3 text-sm text-subtle">Carregando ranking…</p>
        ) : ranking.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">
            Nenhuma pontuação importada ainda. Use a importação CSV ou encerre edições para acumular
            pontos.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-card-muted text-subtle">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Jogador</th>
                  <th className="px-3 py-2">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry) => (
                  <tr key={entry.playerId} className="border-t border-line">
                    <td className="px-3 py-2 text-subtle">{entry.rank}</td>
                    <td className="px-3 py-2 text-foreground">{entry.playerName}</td>
                    <td className="px-3 py-2 text-muted">{entry.accumulatedPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Edições</h3>
        {editionsQuery.isLoading ? (
          <p className="mt-3 text-sm text-subtle">Carregando edições…</p>
        ) : editions.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">Nenhuma edição criada ainda.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {editions.map((edition) => (
              <li key={edition.id}>
                <Link
                  to={`/organizador/edicao/${edition.id}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-card-muted px-4 py-3 text-foreground transition hover:border-brand"
                >
                  <span>
                    <span className="font-medium">{edition.name}</span>
                    <span className="ml-2 text-sm text-subtle">
                      {formatEditionDate(edition.date)}
                    </span>
                  </span>
                  <span className="text-sm text-subtle">{formatEditionStatus(edition.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
