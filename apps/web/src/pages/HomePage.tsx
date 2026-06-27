import { Link } from 'react-router-dom';
import { usePlayerSession } from '../hooks/use-player-session.js';

export function HomePage() {
  const { session, isLoggedIn, clearSession } = usePlayerSession();

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Infraestrutura PWA pronta</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          O shell do app, cache offline, sessão local do jogador, fila de saída e integração com SSE
          estão configurados. As telas completas do jogador e do organizador serão implementadas em
          T9 e T10.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sessão local</h3>
        {isLoggedIn && session ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              <span className="text-slate-400">Jogador:</span>{' '}
              <span className="font-medium text-white">
                {session.playerName ?? session.playerId}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Edição:</span>{' '}
              <span className="font-mono text-xs text-slate-200">{session.editionId}</span>
            </p>
            <button
              type="button"
              onClick={() => void clearSession()}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              Limpar sessão
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Nenhuma sessão ativa. A seleção de jogador será feita na entrada via QR code (T9).
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        <p>
          Rotas reservadas para os próximos tickets:{' '}
          <Link className="text-brand hover:underline" to="/edicao/exemplo/entrar">
            entrada do jogador
          </Link>
          , partidas, classificação e painel do organizador.
        </p>
      </div>
    </section>
  );
}
