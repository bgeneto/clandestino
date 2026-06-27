import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import { getDrawReadinessWarning } from './draw-utils.js';

describe('getDrawReadinessWarning', () => {
  it('warns when player count is below minimum group size', () => {
    const warning = getDrawReadinessWarning(3, DEFAULT_TOURNAMENT_RULES);
    expect(warning).toContain('4');
  });

  it('warns when configured groups exceed feasible partition', () => {
    const rules = { ...DEFAULT_TOURNAMENT_RULES, protectedSeedCount: 5 };
    const warning = getDrawReadinessWarning(8, rules);
    expect(warning).toContain('5');
  });

  it('returns null when draw is feasible', () => {
    expect(getDrawReadinessWarning(16, DEFAULT_TOURNAMENT_RULES)).toBeNull();
  });
});
