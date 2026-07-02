import { type Static, Type } from '@sinclair/typebox';
import { formatEditionName } from './edition-naming.js';

export const EditionRecurrenceSchema = Type.Union(
  [Type.Literal('none'), Type.Literal('weekly'), Type.Literal('biweekly'), Type.Literal('monthly')],
  { $id: 'EditionRecurrence' },
);

export type EditionRecurrence = Static<typeof EditionRecurrenceSchema>;

export const MAX_RECURRING_EDITION_DATES = 53;

/** Max editions created per bulk operation for weekly and biweekly recurrence. */
export const RECURRENCE_BULK_LIMIT = 4;

export type EditionDateSortable = {
  date: string;
  createdAt: string;
};

function parseIsoDateParts(isoDate: string): { year: number; month: number; day: number } {
  const parts = isoDate.split('-');
  const year = Number.parseInt(parts[0] ?? '', 10);
  const month = Number.parseInt(parts[1] ?? '', 10);
  const day = Number.parseInt(parts[2] ?? '', 10);
  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addMonthsFromAnchorIso(anchorDay: number, isoDate: string, months: number): string {
  const { year, month } = parseIsoDateParts(isoDate);
  const zeroBasedTarget = month - 1 + months;
  const targetYear = year + Math.floor(zeroBasedTarget / 12);
  const targetMonth = (((zeroBasedTarget % 12) + 12) % 12) + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(anchorDay, daysInTargetMonth);
  return formatIsoDate(targetYear, targetMonth, targetDay);
}

export function endOfYearIso(isoDate: string): string {
  const { year } = parseIsoDateParts(isoDate);
  return `${year}-12-31`;
}

export function compareEditionDates(left: EditionDateSortable, right: EditionDateSortable): number {
  if (left.date !== right.date) {
    return left.date < right.date ? -1 : 1;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? -1 : 1;
  }

  return 0;
}

export function generateRecurringEditionDates(
  startDate: string,
  recurrence: EditionRecurrence,
  endDate?: string,
): string[] {
  if (recurrence === 'none') {
    return [startDate];
  }

  const isMonthly = recurrence === 'monthly';
  const hasExplicitEnd = endDate !== undefined;
  const lastDate = hasExplicitEnd || isMonthly ? (endDate ?? endOfYearIso(startDate)) : null;
  const countLimit = !isMonthly && !hasExplicitEnd ? RECURRENCE_BULK_LIMIT : null;

  if (lastDate !== null && startDate > lastDate) {
    return [];
  }

  const dates: string[] = [];
  let current = startDate;
  const anchorDay = parseIsoDateParts(startDate).day;

  while (true) {
    if (countLimit !== null && dates.length >= countLimit) {
      break;
    }
    if (lastDate !== null && current > lastDate) {
      break;
    }

    dates.push(current);

    if (dates.length > MAX_RECURRING_EDITION_DATES) {
      throw new Error(
        `Recorrência excede o limite de ${MAX_RECURRING_EDITION_DATES} edições por operação.`,
      );
    }

    if (recurrence === 'weekly') {
      current = addDaysIso(current, 7);
    } else if (recurrence === 'biweekly') {
      current = addDaysIso(current, 15);
    } else {
      current = addMonthsFromAnchorIso(anchorDay, current, 1);
    }
  }

  return dates;
}

export function computeEditionNameByDate(
  existing: ReadonlyArray<EditionDateSortable>,
  newDate: string,
  newCreatedAt = '9999-12-31T23:59:59.999Z',
): string {
  const merged = [...existing, { date: newDate, createdAt: newCreatedAt }].sort(
    compareEditionDates,
  );
  const index = merged.findIndex(
    (edition) => edition.date === newDate && edition.createdAt === newCreatedAt,
  );

  return formatEditionName(index + 1);
}

export function previewBulkEditionNames(
  existing: ReadonlyArray<EditionDateSortable>,
  newDates: string[],
): Array<{ date: string; name: string }> {
  const syntheticNewEditions = newDates.map((date, index) => ({
    date,
    createdAt: `9999-01-01T00:00:00.${String(index).padStart(3, '0')}Z`,
  }));

  const sorted = [...existing, ...syntheticNewEditions].sort(compareEditionDates);

  return syntheticNewEditions.map((edition) => {
    const index = sorted.findIndex(
      (candidate) => candidate.date === edition.date && candidate.createdAt === edition.createdAt,
    );

    return {
      date: edition.date,
      name: formatEditionName(index + 1),
    };
  });
}

export function countSkippedRecurrenceDates(
  generatedDates: string[],
  existingDates: ReadonlySet<string>,
): { datesToCreate: string[]; skippedDates: string[] } {
  const datesToCreate: string[] = [];
  const skippedDates: string[] = [];

  for (const date of generatedDates) {
    if (existingDates.has(date)) {
      skippedDates.push(date);
    } else {
      datesToCreate.push(date);
    }
  }

  return { datesToCreate, skippedDates };
}
