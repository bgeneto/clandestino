import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '../components/ui/Alert.js';
import { useEdition } from '../hooks/use-edition.js';
import { usePlayerSession } from '../hooks/use-player-session.js';
import { isEditionGone } from '../lib/api-errors.js';
import { purgeEditionLocalState } from '../lib/purge-edition-state.js';

export function HomePage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editionNotFound = searchParams.get('edicao') === 'nao-encontrada';
  const { session, isLoggedIn, clearSession } = usePlayerSession();
  const editionCheck = useEdition(isLoggedIn ? session?.editionId : undefined);

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
          Bem-vindo ao app oficial do campeonato <b>Clandestino</b> de tênis de mesa.
          <br />
          Escaneie o QR code da edição ou acesse o link público para ingressar ou acompanhar ao
          vivo.
        </p>
      </div>

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
              Sair ⮊
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-line bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Área do organizador</h3>
        <p className="mt-1 text-sm text-subtle">
          Gerencie campeonatos, edições, sorteios, participantes e resultados.
        </p>
        <Link
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
          to="/organizador"
        >
          🔐 Acessar painel
        </Link>
      </div>
    </section>
  );
}
