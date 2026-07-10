import { Link, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { Alert } from '../components/ui/Alert.js';
import { ChampionshipRankingTable } from '../components/public/ChampionshipRankingTable.js';
import { EditionListItem } from '../components/public/EditionListItem.js';
import { LiveEditionCard } from '../components/public/LiveEditionCard.js';
import {
  usePublicChampionship,
  usePublicChampionshipEditions,
  usePublicChampionshipRanking,
} from '../hooks/use-public-data.js';
import { partitionPublishedEditions } from '../lib/public-editions.js';

export function PublicChampionshipPage() {
  const { championshipId } = useParams<{ championshipId: string }>();
  const championshipQuery = usePublicChampionship(championshipId);
  const editionsQuery = usePublicChampionshipEditions(championshipId);
  const rankingQuery = usePublicChampionshipRanking(championshipId);

  const { live, finished } = useMemo(
    () => partitionPublishedEditions(editionsQuery.data ?? []),
    [editionsQuery.data],
  );

  const featuredLiveEditionId = live[0]?.id;

  if (championshipQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando campeonato…</p>;
  }

  if (championshipQuery.isError || !championshipQuery.data) {
    return <Alert variant="danger">Campeonato não encontrado.</Alert>;
  }

  const championship = championshipQuery.data;
  const ranking = rankingQuery.data ?? [];
  const publishedCount = live.length + finished.length;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <Link className="text-sm text-subtle underline-offset-2 hover:underline" to="/">
          ← Início
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-foreground">{championship.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {publishedCount} edição(ões) publicada(s) · {ranking.length} jogadores no ranking
        </p>
      </div>

      {live.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Edições ao vivo</h3>
          {live.map((edition, index) => (
            <LiveEditionCard
              key={edition.id}
              edition={edition}
              championshipId={championship.id}
              enableSse={edition.id === featuredLiveEditionId && index === 0}
            />
          ))}
        </section>
      ) : null}

      <div className="rounded-2xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Ranking do campeonato</h3>
        {rankingQuery.isLoading ? (
          <p className="mt-3 text-sm text-subtle">Carregando ranking…</p>
        ) : (
          <div className="mt-4">
            <ChampionshipRankingTable ranking={ranking} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Edições</h3>
        {editionsQuery.isLoading ? (
          <p className="mt-3 text-sm text-subtle">Carregando edições…</p>
        ) : publishedCount === 0 ? (
          <p className="mt-3 text-sm text-subtle">Nenhuma edição disponível.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {live.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                  Ao vivo
                </p>
                <ul className="space-y-2">
                  {live.map((edition) => (
                    <EditionListItem key={edition.id} edition={edition} />
                  ))}
                </ul>
              </div>
            ) : null}

            {finished.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                  Encerradas
                </p>
                <ul className="space-y-2">
                  {finished.map((edition) => (
                    <EditionListItem key={edition.id} edition={edition} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
