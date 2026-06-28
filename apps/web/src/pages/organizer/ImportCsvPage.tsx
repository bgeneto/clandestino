import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ImportScoresCsvRow } from '@clandestino/shared-contracts';
import {
  IMPORT_SCORES_CSV_FORMAT_HINT,
  resolveImportScoresCsvColumns,
  validatePlayerName,
} from '@clandestino/shared-contracts';
import { ApiError } from '../../lib/api-client.js';
import { importChampionshipScores } from '../../lib/organizer-api.js';
import { useChampionship } from '../../hooks/use-organizer-data.js';

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
  const headers = headerLine.split(',').map((header) => header.trim());

  let columnIndexes;
  try {
    columnIndexes = resolveImportScoresCsvColumns(headers);
  } catch (error) {
    return {
      rows: [],
      errors: [
        error instanceof Error
          ? error.message
          : `Cabeçalho inválido. Use: ${IMPORT_SCORES_CSV_FORMAT_HINT}`,
      ],
    };
  }

  const rows: ImportScoresCsvRow[] = [];
  const errors: string[] = [];

  for (let index = 1; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index] ?? '';
    const parts = line.split(',').map((part) => part.trim());
    const rawPlayerName = parts[columnIndexes.playerNameIndex] ?? '';
    const points = Number.parseInt(parts[columnIndexes.accumulatedPointsIndex] ?? '', 10);

    if (!rawPlayerName.trim()) {
      errors.push(`Linha ${lineNumber}: Nome vazio.`);
      continue;
    }

    const nameValidation = validatePlayerName(rawPlayerName);
    if (!nameValidation.ok) {
      errors.push(`Linha ${lineNumber}: ${nameValidation.error}`);
      continue;
    }

    if (!Number.isFinite(points) || points < 0) {
      errors.push(`Linha ${lineNumber}: Pontuação inválida.`);
      continue;
    }

    rows.push({ playerName: nameValidation.name, accumulatedPoints: points });
  }

  return { rows, errors };
}

export function ImportCsvPage() {
  const { championshipId } = useParams<{ championshipId: string }>();
  const championshipQuery = useChampionship(championshipId);
  const [csvContent, setCsvContent] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => parseCsvPreview(csvContent), [csvContent]);

  const importMutation = useMutation({
    mutationFn: () => importChampionshipScores(championshipId!, csvContent),
    onSuccess: (response) => {
      setConfirmed(true);
      const parts = [
        `${response.importedCount} pontuação(ões) importada(s)`,
        response.createdPlayersCount > 0
          ? `${response.createdPlayersCount} jogador(es) cadastrado(s) automaticamente`
          : null,
        response.skippedExistingCount > 0
          ? `${response.skippedExistingCount} linha(s) ignorada(s) (pontuação já existente)`
          : null,
      ].filter(Boolean);
      setFeedback(`Importação concluída: ${parts.join('; ')}.`);
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
        <h2 className="mt-3 text-xl font-semibold text-foreground">Importar pontuação CSV</h2>
        <p className="mt-2 text-sm text-muted">
          {championshipQuery.data
            ? `Campeonato: ${championshipQuery.data.name}`
            : 'Importar ranking acumulado para este campeonato.'}
        </p>
        <p className="mt-2 text-sm text-subtle">
          Colunas obrigatórias: <code className="text-muted">{IMPORT_SCORES_CSV_FORMAT_HINT}</code>
        </p>
        <div className="mt-4 rounded-lg border border-warning-surface bg-warning-surface px-4 py-3 text-sm text-warning-foreground">
          <p className="font-medium">Antes de confirmar, saiba o que acontece:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Jogadores ausentes no cadastro serão criados automaticamente.</li>
            <li>
              Pontuações já importadas para este campeonato <strong>não serão alteradas</strong>.
            </li>
            <li>Somente jogadores sem pontuação no campeonato receberão os valores do CSV.</li>
          </ul>
        </div>
      </div>

      {championshipQuery.isLoading ? (
        <p className="text-sm text-subtle">Carregando campeonato…</p>
      ) : championshipQuery.isError ? (
        <p className="text-sm text-danger-foreground">Campeonato não encontrado.</p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-line bg-card p-6">
          <label className="block space-y-2 text-sm">
            <span className="text-muted">Conteúdo CSV</span>
            <textarea
              value={csvContent}
              onChange={(event) => {
                setCsvContent(event.target.value);
                setConfirmed(false);
                setAcknowledged(false);
                setFeedback(null);
                setError(null);
              }}
              rows={8}
              className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 font-mono text-sm text-foreground"
              placeholder={'Posição,Nome,Pontuação\n1,Carlos Mendes,1200\n2,Ana Souza,980'}
            />
          </label>

          {preview.errors.length > 0 ? (
            <div className="rounded-lg border border-warning-surface bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
              {preview.errors.map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          ) : null}

          {preview.rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-card-muted text-subtle">
                  <tr>
                    <th className="px-3 py-2">Jogador</th>
                    <th className="px-3 py-2">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.playerName} className="border-t border-line">
                      <td className="px-3 py-2 text-foreground">{row.playerName}</td>
                      <td className="px-3 py-2 text-muted">{row.accumulatedPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-danger-surface bg-danger-surface px-3 py-2 text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}

          {feedback ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-100">
              {feedback}
            </p>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 rounded border-line bg-card-muted"
            />
            <span>
              Entendo que jogadores ausentes serão cadastrados e pontuações já existentes não serão
              sobrescritas.
            </span>
          </label>

          <button
            type="button"
            disabled={
              importMutation.isPending ||
              preview.rows.length === 0 ||
              preview.errors.length > 0 ||
              !acknowledged ||
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
