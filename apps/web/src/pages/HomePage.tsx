import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '../components/ui/Alert.js';
import { PublicChampionshipCard } from '../components/public/PublicChampionshipCard.js';
import { useEdition } from '../hooks/use-edition.js';
import { usePlayerSession } from '../hooks/use-player-session.js';
import { usePublicChampionships } from '../hooks/use-public-data.js';
import { isEditionGone } from '../lib/api-errors.js';
import { purgeEditionLocalState } from '../lib/purge-edition-state.js';

export function HomePage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editionNotFound = searchParams.get('edicao') === 'nao-encontrada';
  const { session, isLoggedIn, clearSession } = usePlayerSession();
  const editionCheck = useEdition(isLoggedIn ? session?.editionId : undefined);

  const championshipsQuery = usePublicChampionships();
  const championships = championshipsQuery.data ?? [];

  const sessionEditionGone =
    editionCheck.isError && session?.editionId !== undefined && isEditionGone(editionCheck.error);

  useEffect(() => {
    if (!sessionEditionGone || !session?.editionId) {
      return;
    }

    void purgeEditionLocalState(session.editionId, queryClient);
  }, [sessionEditionGone, session?.editionId, queryClient]);

  const showSession = isLoggedIn && session && !sessionEditionGone;

  return (
    <section className="space-y-6">
      {editionNotFound ? (
        <Alert variant="warning">Esta edição não existe mais ou foi removida.</Alert>
      ) : null}

      <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-xl font-semibold text-foreground">🏓 Clandestino</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Acompanhe partidas ao vivo, grupos, placares e ranking do campeonato.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Campeonatos</h3>
        <p className="mt-1 text-sm text-subtle">
          Clique em um campeonato abaixo para ver o ranking, edições e placares.
        </p>
      </div>

      {championshipsQuery.isLoading ? (
        <p className="text-sm text-subtle">Carregando campeonatos…</p>
      ) : championships.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-6">
          <p className="text-sm text-subtle">Nenhum campeonato publicado.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {championships.map((championship) => (
            <PublicChampionshipCard key={championship.id} championship={championship} />
          ))}
        </div>
      )}

      {showSession ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-sm">
          <p>
            <span className="text-subtle">Sessão ativa:</span>{' '}
            <span className="font-medium text-foreground">
              {session.playerName ?? session.playerId}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white"
              to={`/edicao/${session.editionId}/partidas`}
            >
              Minhas partidas
            </Link>
            <button
              type="button"
              onClick={() => void clearSession()}
              className="rounded-lg border border-line px-4 py-2 text-muted"
            >
              Sair
            </button>
          </div>
        </div>
      ) : null}

      <footer className="pt-2 text-center">
        <Link className="text-sm text-subtle underline-offset-2 hover:underline" to="/organizador">
          Organizador? Acessar painel
        </Link>
      </footer>
    </section>
  );
}
