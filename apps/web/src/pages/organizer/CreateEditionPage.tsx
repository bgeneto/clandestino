import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatEditionName } from '@clandestino/shared-contracts';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client.js';
import { createEdition } from '../../lib/organizer-api.js';
import { useChampionship, useChampionshipEditions } from '../../hooks/use-organizer-data.js';
import { createEditionWizardDraft } from '../../offline/edition-wizard-draft.js';
import { Alert } from '../../components/ui/Alert.js';

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CreateEditionPage() {
  const navigate = useNavigate();
  const { championshipId } = useParams<{ championshipId: string }>();
  const championshipQuery = useChampionship(championshipId);
  const editionsQuery = useChampionshipEditions(championshipId);
  const [date, setDate] = useState(todayIsoDate);
  const [autoConfirmMinutes, setAutoConfirmMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const predictedName = useMemo(() => {
    const editionCount = editionsQuery.data?.length ?? 0;
    return formatEditionName(editionCount + 1);
  }, [editionsQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine) {
        const draft = await createEditionWizardDraft({
          championshipId: championshipId!,
          predictedEditionName: predictedName,
          date,
          autoConfirmMinutes,
        });
        return { mode: 'offline' as const, draftId: draft.id };
      }

      const edition = await createEdition({
        championshipId: championshipId!,
        date,
        autoConfirmMinutes,
      });
      await createEditionWizardDraft({
        championshipId: championshipId!,
        editionId: edition.id,
        predictedEditionName: edition.name,
        date,
        autoConfirmMinutes,
      });
      return { mode: 'online' as const, editionId: edition.id };
    },
    onSuccess: (result) => {
      if (result.mode === 'offline') {
        void navigate(
          `/organizador/campeonato/${championshipId}/edicao/rascunho/${result.draftId}/preparar`,
        );
        return;
      }

      void navigate(`/organizador/edicao/${result.editionId}/preparar`);
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError) {
        setError(mutationError.message);
        return;
      }

      setError('Não foi possível criar a edição.');
    },
  });

  if (!championshipId) {
    return <Alert variant="danger">Campeonato não informado.</Alert>;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <Link
          className="text-sm text-subtle underline"
          to={`/organizador/campeonato/${championshipId}`}
        >
          ← Voltar ao campeonato
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-foreground">Nova edição</h2>
        <p className="mt-2 text-sm text-muted">
          {championshipQuery.data
            ? `Campeonato: ${championshipQuery.data.name}`
            : 'Configure a rodada neste campeonato.'}
        </p>
      </div>

      {championshipQuery.isLoading ? (
        <p className="text-sm text-subtle">Carregando campeonato…</p>
      ) : championshipQuery.isError ? (
        <Alert variant="warning">Campeonato não encontrado.</Alert>
      ) : championshipQuery.data?.archivedAt ? (
        <Alert variant="warning">
          Este campeonato está arquivado. Desarquive-o para criar novas edições.
        </Alert>
      ) : (
        <form
          className="space-y-4 rounded-2xl border border-line bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            void createMutation.mutateAsync();
          }}
        >
          <label className="block space-y-2 text-sm">
            <span className="text-muted">Nome da Edição</span>
            <input
              readOnly
              value={predictedName}
              className="w-full cursor-default rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-muted">Data do Evento</span>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-muted">Auto-confirmação (minutos)</span>
            <input
              required
              type="number"
              min={1}
              value={autoConfirmMinutes}
              onChange={(event) =>
                setAutoConfirmMinutes(Number.parseInt(event.target.value, 10) || 15)
              }
              className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            />
            <span className="text-xs text-subtle">
              💡Após esse tempo, resultados aguardando confirmação são confirmados automaticamente
              se não houver contestação.
            </span>
          </label>

          {!navigator.onLine ? (
            <p className="rounded-lg border border-warning-surface bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
              Sem conexão: a edição será preparada localmente e sincronizada quando a internet
              voltar.
            </p>
          ) : null}

          {error ? <Alert variant="danger">{error}</Alert> : null}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {createMutation.isPending ? 'Criando…' : 'Continuar para check-in →'}
          </button>
        </form>
      )}
    </section>
  );
}
