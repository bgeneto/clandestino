import { describe, expect, it } from 'vitest';
import {
  computeEditionNameByDate,
  countSkippedRecurrenceDates,
  endOfYearIso,
  generateRecurringEditionDates,
  previewBulkEditionNames,
} from './edition-recurrence.js';

describe('edition-recurrence', () => {
  it('returns end of year for a date', () => {
    expect(endOfYearIso('2026-07-04')).toBe('2026-12-31');
  });

  it('generates weekly dates up to the bulk limit', () => {
    const dates = generateRecurringEditionDates('2026-07-04', 'weekly');
    expect(dates).toEqual(['2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25']);
  });

  it('generates biweekly dates up to the bulk limit', () => {
    const dates = generateRecurringEditionDates('2026-07-04', 'biweekly');
    expect(dates).toEqual(['2026-07-04', '2026-07-19', '2026-08-03', '2026-08-18']);
  });

  it('honors an explicit end date over the bulk limit', () => {
    const dates = generateRecurringEditionDates('2026-12-01', 'weekly', '2026-12-31');
    expect(dates).toEqual(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29']);
  });

  it('generates biweekly dates until an explicit end date', () => {
    const dates = generateRecurringEditionDates('2026-01-01', 'biweekly', '2026-01-31');
    expect(dates).toEqual(['2026-01-01', '2026-01-16', '2026-01-31']);
  });

  it('generates monthly dates until year end by default', () => {
    const dates = generateRecurringEditionDates('2026-07-04', 'monthly');
    expect(dates).toEqual([
      '2026-07-04',
      '2026-08-04',
      '2026-09-04',
      '2026-10-04',
      '2026-11-04',
      '2026-12-04',
    ]);
  });

  it('clamps monthly recurrence to shorter months', () => {
    const dates = generateRecurringEditionDates('2026-01-31', 'monthly', '2026-04-30');
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('names a new edition by chronological position', () => {
    const existing = [
      { date: '2026-08-01', createdAt: '2026-01-01T00:00:00.000Z' },
      { date: '2026-10-01', createdAt: '2026-01-02T00:00:00.000Z' },
    ];

    expect(computeEditionNameByDate(existing, '2026-07-04')).toBe('Clandestino #1');
    expect(computeEditionNameByDate(existing, '2026-09-01')).toBe('Clandestino #2');
    expect(computeEditionNameByDate(existing, '2026-11-01')).toBe('Clandestino #3');
  });

  it('previews bulk names after merge and sort', () => {
    const existing = [{ date: '2026-08-01', createdAt: '2026-01-01T00:00:00.000Z' }];
    const preview = previewBulkEditionNames(existing, ['2026-07-04', '2026-09-01']);

    expect(preview).toEqual([
      { date: '2026-07-04', name: 'Clandestino #1' },
      { date: '2026-09-01', name: 'Clandestino #3' },
    ]);
  });

  it('skips duplicate dates when counting recurrence output', () => {
    const result = countSkippedRecurrenceDates(
      ['2026-07-04', '2026-07-11', '2026-07-18'],
      new Set(['2026-07-11']),
    );

    expect(result.datesToCreate).toEqual(['2026-07-04', '2026-07-18']);
    expect(result.skippedDates).toEqual(['2026-07-11']);
  });
});
