import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useChampionship,
  useChampionshipEditions,
  useChampionshipRanking,
} from '../../hooks/use-organizer-data.js';
import { formatEditionDate, formatEditionStatus } from '../../lib/format.js';
import { Alert } from '../../components/ui/Alert.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { ApiError } from '../../lib/api-client.js';
import {
  archiveChampionship,
  deleteChampionship,
  unarchiveChampionship,
} from '../../lib/organizer-api.js';
import { queryKeys } from '../../lib/query-keys.js';

const archiveButtonBaseClasses =
  'inline-flex items-center gap-2 rounded-lg border px-4 py-1.5 text-sm font-medium transition';

export function ChampionshipPage() {
  const { championshipId } = useParams<{ championshipId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const championshipQuery = useChampionship(championshipId);
  const editionsQuery = useChampionshipEditions(championshipId);
  const rankingQuery = useChampionshipRanking(championshipId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => deleteChampionship(championshipId!),
    onSuccess: async () => {
      setDeleteError(null);
      setIsDeleteDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.championships() });
      void navigate('/organizador/painel');
    },
    onError: (error) => {
      setDeleteError(
        error instanceof ApiError ? error.message : 'Não foi possível excluir o campeonato.',
      );
      setIsDeleteDialogOpen(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const isArchived = championshipQuery.data?.archivedAt;
      if (isArchived) {
        return unarchiveChampionship(championshipId!);
      }
      return archiveChampionship(championshipId!);
    },
    onSuccess: async () => {
      setArchiveError(null);
      setIsArchiveDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.championships() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.championship(championshipId!) }),
      ]);
      void navigate('/organizador/painel');
    },
    onError: (error) => {
      setArchiveError(
        error instanceof ApiError ? error.message : 'Não foi possível atualizar o campeonato.',
      );
      setIsArchiveDialogOpen(false);
    },
  });

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
  const canDelete = editions.length === 0 && ranking.length === 0;

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
        <div className="mt-4 flex flex-row flex-wrap items-center gap-3">
          {championship.archivedAt ? (
            <button
              type="button"
              onClick={() => setIsArchiveDialogOpen(true)}
              className={`${archiveButtonBaseClasses} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900`}
            >
              📂 Desarquivar campeonato
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsArchiveDialogOpen(true)}
              className={`${archiveButtonBaseClasses} border-line bg-card text-subtle hover:bg-card-muted`}
            >
              📁 Arquivar campeonato
            </button>
          )}
          {canDelete ? (
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              className={`inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900`}
            >
              🗑️ Excluir campeonato
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Excluir campeonato"
        description={
          <>
            Tem certeza que deseja excluir <strong>{championship.name}</strong>? Esta ação não pode
            ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => void deleteMutation.mutateAsync()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={isArchiveDialogOpen}
        title={championship.archivedAt ? 'Desarquivar campeonato' : 'Arquivar campeonato'}
        description={
          championship.archivedAt ? (
            <>
              Tem certeza que deseja desarquivar <strong>{championship.name}</strong>? Ele voltará a
              aparecer na lista principal e permitirá novas edições e importações.
            </>
          ) : (
            <>
              Tem certeza que deseja arquivar <strong>{championship.name}</strong>? Campeonatos
              arquivados não permitem criar novas edições nem importar pontuações CSV.
            </>
          )
        }
        confirmLabel={championship.archivedAt ? 'Desarquivar' : 'Arquivar'}
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={archiveMutation.isPending}
        onConfirm={() => void archiveMutation.mutateAsync()}
        onCancel={() => setIsArchiveDialogOpen(false)}
      />

      {deleteError ? <Alert variant="danger">{deleteError}</Alert> : null}
      {archiveError ? <Alert variant="danger">{archiveError}</Alert> : null}

      {championship.archivedAt ? (
        <Alert variant="warning">
          Este campeonato está arquivado. Não é possível criar novas edições nem importar pontuações
          até que seja desarquivado.
        </Alert>
      ) : (
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
            <p className="mt-1 text-sm text-subtle">Utilizar pontuação já existente</p>
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Ranking atual</h3>
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
          <div>
            <p className="mt-3 text-sm text-subtle">Nenhuma edição criada ainda.</p>
            {!championship.archivedAt ? (
              <Link
                to={`/organizador/campeonato/${championship.id}/edicao/nova`}
                className="mt-3 inline-block rounded-lg border border-brand bg-brand/10 px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand/20"
              >
                Nova edição
              </Link>
            ) : null}
          </div>
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
