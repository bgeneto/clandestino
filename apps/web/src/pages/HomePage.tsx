import { Link } from 'react-router-dom';
import { usePlayerSession } from '../hooks/use-player-session.js';

export function HomePage() {
  const { session, isLoggedIn, clearSession } = usePlayerSession();

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Clandestino</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Campeonato de tênis de mesa da FitPong. Escaneie o QR code da edição ou acesse o link
          público para acompanhar ao vivo.
        </p>
      </div>

      {isLoggedIn && session ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm">
          <p>
            <span className="text-slate-400">Sessão ativa:</span>{' '}
            <span className="font-medium text-white">{session.playerName ?? session.playerId}</span>
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
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200"
            >
              Sair
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        <p>
          Acesse uma edição pela URL <code className="text-slate-300">/edicao/:id</code> ou pela
          entrada via QR code <code className="text-slate-300">/edicao/:id/entrar</code>.
        </p>
        <p className="mt-3">
          <Link className="text-brand underline" to="/organizador">
            Painel do organizador
          </Link>
        </p>
      </div>
    </section>
  );
}
