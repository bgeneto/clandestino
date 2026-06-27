import {
  IMPORT_SCORES_CSV_FORMAT_HINT,
  normalizeCsvHeader,
  resolveImportScoresCsvColumns,
} from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';

describe('resolveImportScoresCsvColumns', () => {
  it('resolves English headers', () => {
    expect(resolveImportScoresCsvColumns(['player_name', 'accumulated_points'])).toEqual({
      playerNameIndex: 0,
      accumulatedPointsIndex: 1,
    });
  });

  it('resolves Portuguese aliases', () => {
    expect(resolveImportScoresCsvColumns(['Nome', 'Pontuação'])).toEqual({
      playerNameIndex: 0,
      accumulatedPointsIndex: 1,
    });
  });

  it('ignores extra columns such as position', () => {
    expect(resolveImportScoresCsvColumns(['Posição', 'Nome', 'Pontuação'])).toEqual({
      playerNameIndex: 1,
      accumulatedPointsIndex: 2,
    });
  });

  it('normalizes accented headers', () => {
    expect(normalizeCsvHeader('Pontuação')).toBe('pontuacao');
    expect(resolveImportScoresCsvColumns(['Posição', 'Nome', 'Pontuação'])).toEqual({
      playerNameIndex: 1,
      accumulatedPointsIndex: 2,
    });
  });

  it('rejects missing required columns', () => {
    expect(() => resolveImportScoresCsvColumns(['Posição', 'Nome'])).toThrow(
      IMPORT_SCORES_CSV_FORMAT_HINT,
    );
  });

  it('rejects duplicate mapped columns', () => {
    expect(() => resolveImportScoresCsvColumns(['Nome', 'player_name', 'Pontuação'])).toThrow(
      /duplicada/i,
    );
  });
});
