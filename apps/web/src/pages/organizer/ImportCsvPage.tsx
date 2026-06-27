import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ImportScoresCsvRow } from '@clandestino/shared-contracts';
import { ApiError } from '../../lib/api-client.js';
import { importSeasonScores } from '../../lib/organizer-api.js';
import { useSeasons } from '../../hooks/use-organizer-data.js';

function parseCsvPreview(content: string): { rows: ImportScoresCsvRow[]; errors: string[] } {
  const normalized = content.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    return { rows: [], errors: [] };
  }

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ['O CSV deve conter cabeçalho e ao menos uma linha de dados.'] };
  }

  const headerLine = lines[0] ?? '';
  const headers = headerLine.split(',').map((header) => header.trim().toLowerCase());
  const nameIndex = headers.indexOf('player_name');
  const pointsIndex = headers.indexOf('accumulated_points');

  if (nameIndex === -1 || pointsIndex === -1) {
    return {
      rows: [],
      errors: ['Cabeçalho inválido. Use: player_name,accumulated_points'],
    };
  }

  const rows: ImportScoresCsvRow[] = [];
  const errors: string[] = [];

  for (let index = 1; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index] ?? '';
    const parts = line.split(',').map((part) => part.trim());
    const playerName = parts[nameIndex] ?? '';
    const points = Number.parseInt(parts[pointsIndex] ?? '', 10);

    if (!playerName) {
      errors.push(`Linha ${lineNumber}: player_name vazio.`);
      continue;
    }

    if (!Number.isFinite(points) || points < 0) {
      errors.push(`Linha ${lineNumber}: accumulated_points inválido.`);
      continue;
    }

    rows.push({ playerName, accumulatedPoints: points });
  }

  return { rows, errors };
}

export function ImportCsvPage() {
  const seasonsQuery = useSeasons();
  const [seasonId, setSeasonId] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveSeasonId = seasonId || seasonsQuery.data?.[0]?.id || '';
  const preview = useMemo(() => parseCsvPreview(csvContent), [csvContent]);

  const importMutation = useMutation({
    mutationFn: () => importSeasonScores(effectiveSeasonId, csvContent),
    onSuccess: (response) => {
      setConfirmed(true);
      setFeedback(`Importados ${response.importedCount} jogadores com sucesso.`);
      setError(null);
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError) {
        setError(mutationError.message);
        return;
      }

      setError('Não foi possível importar o CSV.');
    },
  });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <Link className="text-sm text-slate-400 underline" to="/organizador/painel">
          ← Voltar ao painel
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-white">Importar pontuação CSV</h2>
        <p className="mt-2 text-sm text-slate-300">
          Formato com cabeçalho:{' '}
          <code className="text-slate-200">player_name,accumulated_points</code>
        </p>
      </div>

      {seasonsQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando temporadas…</p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Temporada</span>
            <select
              value={effectiveSeasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
            >
              {(seasonsQuery.data ?? []).map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Conteúdo CSV</span>
            <textarea
              value={csvContent}
              onChange={(event) => {
                setCsvContent(event.target.value);
                setConfirmed(false);
                setFeedback(null);
                setError(null);
              }}
              rows={8}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white"
              placeholder={'player_name,accumulated_points\nCarlos Mendes,1200\nAna Souza,980'}
            />
          </label>

          {preview.errors.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {preview.errors.map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          ) : null}

          {preview.rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Jogador</th>
                    <th className="px-3 py-2">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.playerName} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-white">{row.playerName}</td>
                      <td className="px-3 py-2 text-slate-300">{row.accumulatedPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          {feedback ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {feedback}
            </p>
          ) : null}

          <button
            type="button"
            disabled={
              importMutation.isPending ||
              preview.rows.length === 0 ||
              preview.errors.length > 0 ||
              confirmed
            }
            onClick={() => void importMutation.mutateAsync()}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {importMutation.isPending ? 'Importando…' : 'Confirmar importação'}
          </button>
        </div>
      )}
    </section>
  );
}
