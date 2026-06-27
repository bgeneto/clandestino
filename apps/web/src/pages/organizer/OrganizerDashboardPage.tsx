import { Link, useOutletContext } from 'react-router-dom';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';
import type { OrganizerOutletContext } from './OrganizerLayout.js';

export function OrganizerDashboardPage() {
  const { organizerEmail } = useOutletContext<OrganizerOutletContext>();
  const { clearSession } = useOrganizerSession();

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Organizador</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Painel</h2>
        <p className="mt-2 text-sm text-slate-300">{organizerEmail}</p>
      </div>

      <div className="grid gap-3">
        <Link
          to="/organizador/edicao/nova"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-white transition hover:border-brand"
        >
          <p className="font-medium">Nova edição</p>
          <p className="mt-1 text-sm text-slate-400">Criar torneio e inscrever jogadores</p>
        </Link>

        <Link
          to="/organizador/importar"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-white transition hover:border-brand"
        >
          <p className="font-medium">Importar pontuação CSV</p>
          <p className="mt-1 text-sm text-slate-400">Atualizar ranking acumulado da temporada</p>
        </Link>
      </div>

      <button
        type="button"
        onClick={() => void clearSession()}
        className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
      >
        Sair
      </button>
    </section>
  );
}
