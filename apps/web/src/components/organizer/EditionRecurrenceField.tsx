import type { EditionRecurrence, EditionSummary } from '@clandestino/shared-contracts';
import {
  endOfYearIso,
  generateRecurringEditionDates,
  previewBulkEditionNames,
} from '@clandestino/shared-contracts';
import { useMemo } from 'react';
import { formatEditionDate } from '../../lib/format.js';

const RECURRENCE_OPTIONS: Array<{ value: EditionRecurrence; label: string }> = [
  { value: 'none', label: 'Apenas esta data' },
  { value: 'weekly', label: 'Toda semana' },
  { value: 'biweekly', label: 'A cada 15 dias' },
  { value: 'monthly', label: 'Todo mês' },
];

export type EditionRecurrencePreview = {
  createCount: number;
  skippedCount: number;
  endDate: string | null;
  previewNames: Array<{ date: string; name: string }>;
};

function recurrencePreviewEndDate(
  recurrence: EditionRecurrence,
  startDate: string,
  generatedDates: string[],
): string | null {
  if (recurrence === 'monthly') {
    return endOfYearIso(startDate);
  }

  const lastDate = generatedDates.at(-1);
  return lastDate ?? null;
}

export function useEditionRecurrencePreview(
  recurrence: EditionRecurrence,
  startDate: string,
  existingEditions: EditionSummary[],
): EditionRecurrencePreview | null {
  return useMemo(() => {
    if (recurrence === 'none') {
      return null;
    }

    try {
      const generatedDates = generateRecurringEditionDates(startDate, recurrence);
      const existingDates = new Set(existingEditions.map((edition) => edition.date));
      const skippedCount = generatedDates.filter((date) => existingDates.has(date)).length;
      const createCount = generatedDates.length - skippedCount;
      const previewNames = previewBulkEditionNames(
        existingEditions.map((edition) => ({ date: edition.date, createdAt: edition.createdAt })),
        generatedDates.filter((date) => !existingDates.has(date)),
      );

      return {
        createCount,
        skippedCount,
        endDate: recurrencePreviewEndDate(recurrence, startDate, generatedDates),
        previewNames,
      };
    } catch {
      return null;
    }
  }, [existingEditions, recurrence, startDate]);
}

type EditionRecurrenceFieldProps = {
  recurrence: EditionRecurrence;
  startDate: string;
  existingEditions: EditionSummary[];
  disabled?: boolean;
  onChange: (recurrence: EditionRecurrence) => void;
};

export function EditionRecurrenceField({
  recurrence,
  startDate,
  existingEditions,
  disabled = false,
  onChange,
}: EditionRecurrenceFieldProps) {
  const preview = useEditionRecurrencePreview(recurrence, startDate, existingEditions);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <span className="text-sm text-muted">Recorrência</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RECURRENCE_OPTIONS.map((option) => {
            const isActive = recurrence === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'border-brand bg-brand/10 text-foreground'
                    : 'border-line bg-card-muted text-muted hover:text-foreground'
                } disabled:opacity-60`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {preview && preview.createCount > 0 ? (
        <div className="rounded-lg border border-line bg-card-muted px-3 py-3 text-sm text-muted">
          <p>
            Serão criadas <strong className="text-foreground">{preview.createCount}</strong> edições
            {preview.endDate ? (
              <>
                {' '}
                de <strong className="text-foreground">
                  {formatEditionDate(startDate)}
                </strong> até{' '}
                <strong className="text-foreground">{formatEditionDate(preview.endDate)}</strong>.
              </>
            ) : (
              <>
                {' '}
                a partir de{' '}
                <strong className="text-foreground">{formatEditionDate(startDate)}</strong>.
              </>
            )}
          </p>
          {preview.skippedCount > 0 ? (
            <p className="mt-1 text-xs text-subtle">
              {preview.skippedCount} data(s) já existente(s) será(ão) ignorada(s).
            </p>
          ) : null}
          {preview.previewNames.length > 0 ? (
            <p className="mt-2 text-xs text-subtle">
              {preview.previewNames
                .slice(0, 3)
                .map((entry) => `${entry.name} (${formatEditionDate(entry.date)})`)
                .join(' · ')}
              {preview.previewNames.length > 3
                ? ` · … e mais ${preview.previewNames.length - 3}`
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {preview && preview.createCount === 0 ? (
        <p className="rounded-lg border border-warning-surface bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
          Todas as datas geradas já possuem edição neste campeonato. Escolha outra data inicial ou
          volte ao campeonato para ver as edições existentes.
        </p>
      ) : null}
    </div>
  );
}
