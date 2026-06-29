import { Link } from 'react-router-dom';
import type { OrganizerActiveEdition } from '@clandestino/shared-contracts';
import { formatEditionDate, formatEditionStatus } from '../../lib/format.js';

type ActiveEditionsCardProps = {
  editions: OrganizerActiveEdition[];
  isLoading?: boolean;
};

export function ActiveEditionsCard({ editions, isLoading = false }: ActiveEditionsCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Edições vigentes</h3>
        <p className="mt-3 text-sm text-subtle">Carregando edições…</p>
      </section>
    );
  }

  if (editions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground">Edições vigentes</h3>
      <p className="mt-1 text-sm text-subtle">
        Acesso direto às edições em andamento que podem exigir sua atenção.
      </p>

      <ul className="mt-4 space-y-2">
        {editions.map((edition) => (
          <li key={edition.id}>
            <Link
              to={`/organizador/edicao/${edition.id}`}
              className={[
                'flex items-start justify-between gap-3 rounded-lg border px-4 py-3 transition hover:border-brand',
                edition.needsOrganizerAction
                  ? 'border-amber-300/60 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20'
                  : 'border-line bg-card-muted',
              ].join(' ')}
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  <span>{edition.name}</span>
                  <span className="ml-2 text-sm font-normal text-subtle">
                    {formatEditionDate(edition.date)}
                  </span>
                </p>
                <p className="mt-1 truncate text-sm text-subtle">{edition.championshipName}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                {edition.actionLabel ? (
                  <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                    {edition.actionLabel}
                  </span>
                ) : null}
                <span className="text-xs text-subtle">
                  {formatEditionStatus(edition.status, {
                    placementGroupCount:
                      edition.status === 'FASE_COLOCACAO' ? edition.placementGroupCount : undefined,
                  })}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
