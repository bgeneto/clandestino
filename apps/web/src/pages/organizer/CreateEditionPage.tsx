import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { ApiError } from '../../lib/api-client.js';
import { createEdition } from '../../lib/organizer-api.js';
import { useChampionship } from '../../hooks/use-organizer-data.js';

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
  const [date, setDate] = useState(todayIsoDate);
  const [groupCount, setGroupCount] = useState(DEFAULT_EDITION_RULES.protectedSeedCount);
  const [bestOfThreeThreshold, setBestOfThreeThreshold] = useState(
    DEFAULT_EDITION_RULES.participantThresholdForBestOfThree,
  );
  const [autoConfirmMinutes, setAutoConfirmMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const defaultRules = championshipQuery.data?.defaultEditionRules ?? DEFAULT_EDITION_RULES;

  const createMutation = useMutation({
    mutationFn: () =>
      createEdition({
        championshipId: championshipId!,
        date,
        autoConfirmMinutes,
        rules: {
          ...defaultRules,
          protectedSeedCount: groupCount,
          participantThresholdForBestOfThree: bestOfThreeThreshold,
        },
      }),
    onSuccess: (edition) => {
      void navigate(`/organizador/edicao/${edition.id}`);
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
    return (
      <section className="rounded-2xl border border-danger-surface bg-danger-surface p-6 text-sm text-danger-foreground">
        Campeonato não informado.
      </section>
    );
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
        <div className="rounded-2xl border border-warning-surface bg-warning-surface p-4 text-sm text-warning-foreground">
          Campeonato não encontrado.
        </div>
      ) : (
        <form
          className="space-y-4 rounded-2xl border border-line bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            void createMutation.mutateAsync();
          }}
        >
          <p className="rounded-lg border border-line bg-card-muted px-3 py-2.5 text-sm text-subtle">
            O nome será atribuído automaticamente (ex.: Clandestino #3) conforme a numeração
            sequencial deste campeonato.
          </p>

          <label className="block space-y-2 text-sm">
            <span className="text-muted">Data</span>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-muted">Número de grupos</span>
            <input
              required
              type="number"
              min={1}
              max={12}
              value={groupCount}
              onChange={(event) => setGroupCount(Number.parseInt(event.target.value, 10) || 1)}
              className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            />
            <span className="text-xs text-subtle">
              1 seed por grupo (top {groupCount} do ranking)
            </span>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-muted">Limiar para melhor de 3</span>
            <input
              required
              type="number"
              min={1}
              value={bestOfThreeThreshold}
              onChange={(event) =>
                setBestOfThreeThreshold(Number.parseInt(event.target.value, 10) || 1)
              }
              className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            />
            <span className="text-xs text-subtle">
              Acima deste número de inscritos, partidas são melhor de 5
            </span>
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
          </label>

          {error ? (
            <p className="rounded-lg border border-danger-surface bg-danger-surface px-3 py-2 text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {createMutation.isPending ? 'Criando…' : 'Criar edição'}
          </button>
        </form>
      )}
    </section>
  );
}
