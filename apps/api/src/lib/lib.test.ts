import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import { parseImportScoresCsv } from './csv.js';
import { validateScoringTable, validateTournamentRules } from './errors.js';

describe('parseImportScoresCsv', () => {
  it('parses valid CSV content', () => {
    const rows = parseImportScoresCsv(`player_name,accumulated_points
Ana Souza,142
Bruno Lima,89`);

    expect(rows).toEqual([
      { playerName: 'Ana Souza', accumulatedPoints: 142, lineNumber: 2 },
      { playerName: 'Bruno Lima', accumulatedPoints: 89, lineNumber: 3 },
    ]);
  });

  it('parses Portuguese headers and ignores extra position column', () => {
    const rows = parseImportScoresCsv(`Posição,Nome,Pontuação
1,LUCAS LIMA,3947
2,FERNANDO,2850
23,FÁTIMA,135`);

    expect(rows).toEqual([
      { playerName: 'LUCAS LIMA', accumulatedPoints: 3947, lineNumber: 2 },
      { playerName: 'FERNANDO', accumulatedPoints: 2850, lineNumber: 3 },
      { playerName: 'FÁTIMA', accumulatedPoints: 135, lineNumber: 4 },
    ]);
  });

  it('accepts nome,pontos alias pair', () => {
    const rows = parseImportScoresCsv(`nome,pontos
Ana Souza,10`);

    expect(rows).toEqual([{ playerName: 'Ana Souza', accumulatedPoints: 10, lineNumber: 2 }]);
  });

  it('rejects duplicate player names', () => {
    expect(() =>
      parseImportScoresCsv(`player_name,accumulated_points
Ana Souza,10
Ana Souza,20`),
    ).toThrow(/linha 3/i);
  });

  it('rejects headers without required columns', () => {
    expect(() =>
      parseImportScoresCsv(`posição,nome
Ana Souza`),
    ).toThrow(/cabeçalho inválido/i);
  });

  it('rejects negative points', () => {
    expect(() =>
      parseImportScoresCsv(`player_name,accumulated_points
Ana Souza,-1`),
    ).toThrow(/linha 2/i);
  });
});

describe('validateTournamentRules', () => {
  it('accepts default rules', () => {
    expect(validateTournamentRules(DEFAULT_TOURNAMENT_RULES)).toBeNull();
  });

  it('rejects inconsistent group sizes', () => {
    expect(
      validateTournamentRules({
        ...DEFAULT_TOURNAMENT_RULES,
        minimumGroupSize: 6,
        preferredGroupSize: 4,
      }),
    ).toMatch(/minimumGroupSize/i);
  });
});

describe('validateScoringTable', () => {
  it('rejects duplicate positions', () => {
    expect(
      validateScoringTable([
        { position: 1, points: 200 },
        { position: 1, points: 180 },
      ]),
    ).toMatch(/posição 1/i);
  });
});
