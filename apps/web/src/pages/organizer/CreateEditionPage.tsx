import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { computeEditionNameByDate, type EditionRecurrence } from '@clandestino/shared-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EditionRecurrenceField,
  useEditionRecurrencePreview,
} from '../../components/organizer/EditionRecurrenceField.js';
import { createEdition } from '../../lib/organizer-api.js';
import { useChampionship, useChampionshipEditions } from '../../hooks/use-organizer-data.js';
import { createEditionWizardDraft } from '../../offline/edition-wizard-draft.js';
import { notifyApiError } from '../../notifications/notify-api-error.js';
import { useNotification } from '../../notifications/notification-context.js';
import { Alert } from '../../components/ui/Alert.js';
import { cacheCreatedEditions } from '../../lib/championship-query-cache.js';
import { invalidateChampionshipQueries } from '../../lib/invalidate-edition-queries.js';

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CreateEditionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotification();
  const { championshipId } = useParams<{ championshipId: string }>();
  const championshipQuery = useChampionship(championshipId);
  const editionsQuery = useChampionshipEditions(championshipId);
  const [date, setDate] = useState(todayIsoDate);
  const [recurrence, setRecurrence] = useState<EditionRecurrence>('none');
  const [autoConfirmMinutes, setAutoConfirmMinutes] = useState(15);

  const existingEditions = editionsQuery.data ?? [];
  const isRecurring = recurrence !== 'none';
  const isOffline = !navigator.onLine;
  const recurrencePreview = useEditionRecurrencePreview(recurrence, date, existingEditions);
  const hasNothingToCreate = isRecurring && (recurrencePreview?.createCount ?? 0) === 0;

  const predictedName = useMemo(() => {
    if (isRecurring) {
      return null;
    }

    return computeEditionNameByDate(
      existingEditions.map((edition) => ({
        date: edition.date,
        createdAt: edition.createdAt,
      })),
      date,
    );
  }, [date, existingEditions, isRecurring]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isOffline) {
        if (isRecurring) {
          throw new Error('Recorrência indisponível sem conexão.');
        }

        const draft = await createEditionWizardDraft({
          championshipId: championshipId!,
          predictedEditionName: predictedName!,
          date,
          autoConfirmMinutes,
        });
        return { mode: 'offline' as const, draftId: draft.id };
      }

      const result = await createEdition({
        championshipId: championshipId!,
        date,
        recurrence,
        autoConfirmMinutes,
      });

      if (result.createdCount === 0) {
        throw new Error('Nenhuma edição foi criada.');
      }

      if (!isRecurring) {
        const edition = result.editions[0];
        if (!edition) {
          throw new Error('Não foi possível criar a edição.');
        }

        await createEditionWizardDraft({
          championshipId: championshipId!,
          editionId: edition.id,
          predictedEditionName: edition.name,
          date,
          autoConfirmMinutes,
        });

        return {
          mode: 'online-single' as const,
          editionId: edition.id,
          createdEditions: result.editions,
        };
      }

      return {
        mode: 'online-bulk' as const,
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        createdEditions: result.editions,
      };
    },
    onSuccess: async (result) => {
      if (result.mode === 'offline') {
        void navigate(
          `/organizador/campeonato/${championshipId}/edicao/rascunho/${result.draftId}/preparar`,
        );
        return;
      }

      cacheCreatedEditions(queryClient, championshipId!, result.createdEditions);
      await invalidateChampionshipQueries(queryClient, championshipId!);

      if (result.mode === 'online-single') {
        void navigate(`/organizador/edicao/${result.editionId}/preparar`);
        return;
      }

      void navigate(`/organizador/campeonato/${championshipId}`);
      notify.success(`${result.createdCount} edições criadas.`, {
        description:
          result.skippedCount > 0
            ? `${result.skippedCount} datas ignoradas por já existirem.`
            : undefined,
      });
    },
    onError: (mutationError) => {
      notifyApiError(notify, mutationError, 'Não foi possível criar a edição.');
    },
  });

  if (!championshipId) {
    return <Alert variant="danger">Campeonato não informado.</Alert>;
  }

  const submitLabel = createMutation.isPending
    ? 'Criando…'
    : isRecurring
      ? 'Criar edições recorrentes'
      : 'Continuar para check-in →';

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
            void createMutation.mutateAsync();
          }}
        >
          {predictedName ? (
            <label className="block space-y-2 text-sm">
              <span className="text-muted">Nome da Edição</span>
              <input
                readOnly
                value={predictedName}
                className="w-full cursor-default rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
              />
            </label>
          ) : null}

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

          <EditionRecurrenceField
            recurrence={recurrence}
            startDate={date}
            existingEditions={existingEditions}
            disabled={isOffline}
            onChange={setRecurrence}
          />

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

          {isOffline ? (
            <p className="rounded-lg border border-warning-surface bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
              Sem conexão: a edição será preparada localmente e sincronizada quando a internet
              voltar.
              {isRecurring ? ' A recorrência exige conexão.' : ''}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={createMutation.isPending || (isOffline && isRecurring) || hasNothingToCreate}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>
      )}
    </section>
  );
}
