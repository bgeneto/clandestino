import { Link, useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActiveEditionsCard } from '../../components/organizer/ActiveEditionsCard.js';
import { useChampionships, useOrganizerActiveEditions } from '../../hooks/use-organizer-data.js';
import { archiveChampionship, unarchiveChampionship } from '../../lib/organizer-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import { ApiError } from '../../lib/api-client.js';
import type { Championship } from '@clandestino/shared-contracts';
import type { OrganizerOutletContext } from './OrganizerLayout.js';

function ChampionshipCard({
  championship,
  action,
}: {
  championship: Championship;
  action: 'archive' | 'unarchive';
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'archive') {
        return archiveChampionship(championship.id);
      }
      return unarchiveChampionship(championship.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.championships() });
    },
  });

  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-4 transition hover:border-brand">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/organizador/campeonato/${championship.id}`} className="flex-1 text-foreground">
          <p className="font-medium">{championship.name}</p>
          <p className="mt-1 text-sm text-subtle">
            Ranking, edições e importação CSV deste campeonato
          </p>
        </Link>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => void mutation.mutateAsync()}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-subtle transition hover:bg-card-muted disabled:opacity-50"
          title={action === 'archive' ? 'Arquivar campeonato' : 'Desarquivar campeonato'}
        >
          {mutation.isPending ? '…' : action === 'archive' ? '📁 Arquivar' : '📂 Desarquivar'}
        </button>
      </div>
      {mutation.isError ? (
        <p className="mt-2 text-xs text-rose-600">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : 'Não foi possível atualizar o campeonato.'}
        </p>
      ) : null}
    </div>
  );
}

export function OrganizerDashboardPage() {
  const { organizerEmail } = useOutletContext<OrganizerOutletContext>();
  const championshipsQuery = useChampionships();
  const activeEditionsQuery = useOrganizerActiveEditions();

  const championships = championshipsQuery.data ?? [];
  const activeChampionships = championships.filter((championship) => !championship.archivedAt);
  const archivedChampionships = championships.filter((championship) => championship.archivedAt);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-subtle">Organizador</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Painel de Administração</h2>
        <p className="mt-2 text-sm text-muted">{organizerEmail}</p>
      </div>

      <ActiveEditionsCard
        editions={activeEditionsQuery.data ?? []}
        isLoading={activeEditionsQuery.isLoading}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Todos os Campeonatos</h3>
          <p className="mt-1 text-sm text-subtle">
            Clique em um campeonato abaixo para ver o ranking, edições e outras informações.
          </p>
        </div>
        <Link
          to="/organizador/campeonato/novo"
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
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
        <>
          {activeChampionships.length === 0 ? (
            <div className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
              Nenhum campeonato ativo. Os campeonatos arquivados aparecem abaixo.
            </div>
          ) : (
            <div className="grid gap-3">
              {activeChampionships.map((championship) => (
                <ChampionshipCard
                  key={championship.id}
                  championship={championship}
                  action="archive"
                />
              ))}
            </div>
          )}

          {archivedChampionships.length > 0 ? (
            <details className="group rounded-2xl border border-line bg-card">
              <summary className="cursor-pointer list-none p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-subtle">
                    Campeonatos arquivados ({archivedChampionships.length})
                  </span>
                  <span className="text-subtle transition group-open:rotate-180">▼</span>
                </div>
              </summary>
              <div className="grid gap-3 border-t border-line p-4">
                {archivedChampionships.map((championship) => (
                  <ChampionshipCard
                    key={championship.id}
                    championship={championship}
                    action="unarchive"
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
