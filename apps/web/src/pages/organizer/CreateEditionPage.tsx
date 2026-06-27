import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { ApiError } from '../../lib/api-client.js';
import { createEdition } from '../../lib/organizer-api.js';
import { useSeasons } from '../../hooks/use-organizer-data.js';

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CreateEditionPage() {
  const navigate = useNavigate();
  const seasonsQuery = useSeasons();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIsoDate);
  const [seasonId, setSeasonId] = useState('');
  const [groupCount, setGroupCount] = useState(DEFAULT_TOURNAMENT_RULES.protectedSeedCount);
  const [bestOfThreeThreshold, setBestOfThreeThreshold] = useState(
    DEFAULT_TOURNAMENT_RULES.participantThresholdForBestOfThree,
  );
  const [autoConfirmMinutes, setAutoConfirmMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const effectiveSeasonId = seasonId || seasonsQuery.data?.[0]?.id || '';

  const createMutation = useMutation({
    mutationFn: () =>
      createEdition({
        seasonId: effectiveSeasonId,
        name: name.trim(),
        date,
        autoConfirmMinutes,
        rules: {
          ...DEFAULT_TOURNAMENT_RULES,
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

  const seasonOptions = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <Link className="text-sm text-slate-400 underline" to="/organizador/painel">
          ← Voltar ao painel
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-white">Nova edição</h2>
        <p className="mt-2 text-sm text-slate-300">
          Configure a rodada semanal. A tabela de pontuação vem da temporada selecionada.
        </p>
      </div>

      {seasonsQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando temporadas…</p>
      ) : seasonOptions.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Nenhuma temporada cadastrada. Crie uma temporada pela API antes de criar edições.
        </div>
      ) : (
        <form
          className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            void createMutation.mutateAsync();
          }}
        >
          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Temporada</span>
            <select
              value={effectiveSeasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            >
              {seasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Nome da edição</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
              placeholder="Clandestino #42"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Data</span>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Número de grupos</span>
            <input
              required
              type="number"
              min={1}
              max={12}
              value={groupCount}
              onChange={(event) => setGroupCount(Number.parseInt(event.target.value, 10) || 1)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            />
            <span className="text-xs text-slate-500">
              1 seed por grupo (top {groupCount} do ranking)
            </span>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Limiar para melhor de 3</span>
            <input
              required
              type="number"
              min={1}
              value={bestOfThreeThreshold}
              onChange={(event) =>
                setBestOfThreeThreshold(Number.parseInt(event.target.value, 10) || 1)
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            />
            <span className="text-xs text-slate-500">
              Acima deste número de inscritos, partidas são melhor de 5
            </span>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Auto-confirmação (minutos)</span>
            <input
              required
              type="number"
              min={1}
              value={autoConfirmMinutes}
              onChange={(event) =>
                setAutoConfirmMinutes(Number.parseInt(event.target.value, 10) || 15)
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
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
