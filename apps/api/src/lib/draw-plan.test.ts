import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import {
  deriveRulesFromDrawPlan,
  mergeDrawPlan,
  validateDrawPlanAgainstRegistrations,
} from './draw-plan.js';

describe('draw-plan', () => {
  it('merges partial draw plan patches', () => {
    expect(
      mergeDrawPlan({ groupCount: 2, groupSizes: [3, 3] }, { seedPlayerIds: ['a', 'b'] }),
    ).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
    });
  });

  it('derives rules from group count', () => {
    expect(
      deriveRulesFromDrawPlan(DEFAULT_EDITION_RULES, {
        groupCount: 2,
        groupSizes: [3, 3],
      }),
    ).toMatchObject({
      minimumGroupSize: 3,
      protectedSeedCount: 2,
    });
  });

  it('validates seed count against group count', () => {
    const error = validateDrawPlanAgainstRegistrations(
      {
        groupCount: 2,
        groupSizes: [3, 3],
        seedPlayerIds: ['a'],
      },
      6,
      new Set(['a', 'b', 'c', 'd', 'e', 'f']),
    );

    expect(error).toContain('seeds');
  });
});
