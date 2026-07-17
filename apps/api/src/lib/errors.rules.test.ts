import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import { validateEditionRules } from './errors.js';

describe('validateEditionRules', () => {
  it('aceita as regras padrão', () => {
    expect(validateEditionRules(DEFAULT_EDITION_RULES)).toBeNull();
  });

  it('rejeita seedingMethod não implementado', () => {
    expect(
      validateEditionRules({
        ...DEFAULT_EDITION_RULES,
        seedingMethod: 'snake',
      }),
    ).toContain('seedingMethod');
  });

  it('rejeita critérios de ranking não implementados', () => {
    expect(
      validateEditionRules({
        ...DEFAULT_EDITION_RULES,
        groupRankingCriteria: ['SETS_WON', 'POINTS_DIFF'],
      }),
    ).toContain('POINTS_DIFF');

    expect(
      validateEditionRules({
        ...DEFAULT_EDITION_RULES,
        groupRankingCriteria: ['RANDOM_OR_ORGANIZER'],
      }),
    ).toContain('RANDOM_OR_ORGANIZER');
  });

  it('rejeita knockout genérico ainda não suportado', () => {
    expect(
      validateEditionRules({
        ...DEFAULT_EDITION_RULES,
        placementStageFormat: 'knockout',
      }),
    ).toContain('knockout');
  });
});
