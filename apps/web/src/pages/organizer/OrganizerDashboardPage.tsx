import { Link, useOutletContext } from 'react-router-dom';
import { useChampionships } from '../../hooks/use-organizer-data.js';
import type { OrganizerOutletContext } from './OrganizerLayout.js';

export function OrganizerDashboardPage() {
  const { organizerEmail } = useOutletContext<OrganizerOutletContext>();
  const championshipsQuery = useChampionships();

  const championships = championshipsQuery.data ?? [];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-subtle">Organizador</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Painel</h2>
        <p className="mt-2 text-sm text-muted">{organizerEmail}</p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Todos os Campeonatos</h3>
        <Link
          to="/organizador/campeonato/novo"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          🞤 Novo campeonato
        </Link>
      </div>

      {championshipsQuery.isLoading ? (
        <p className="text-sm text-subtle">Carregando campeonatos…</p>
      ) : championships.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
          Nenhum campeonato cadastrado. Crie o primeiro para começar.
        </div>
      ) : (
        <div className="grid gap-3">
          {championships.map((championship) => (
            <Link
              key={championship.id}
              to={`/organizador/campeonato/${championship.id}`}
              className="rounded-2xl border border-line bg-card px-5 py-4 text-foreground transition hover:border-brand"
            >
              <p className="font-medium">{championship.name}</p>
              <p className="mt-1 text-sm text-subtle">
                Ranking, edições e importação CSV deste campeonato
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
