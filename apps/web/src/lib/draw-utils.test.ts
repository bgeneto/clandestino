import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import {
  canExecuteExplicitDraw,
  getDrawReadinessWarning,
  resolveEffectiveDrawPlan,
} from './draw-utils.js';

describe('getDrawReadinessWarning', () => {
  it('warns when player count is below minimum group size', () => {
    const warning = getDrawReadinessWarning(2, DEFAULT_TOURNAMENT_RULES);
    expect(warning).toContain('3');
  });

  it('warns when automatic seed count does not match group count', () => {
    const warning = getDrawReadinessWarning(6, DEFAULT_TOURNAMENT_RULES);
    expect(warning).toContain('cabeça');
  });

  it('warns when configured seeds do not equal feasible group count', () => {
    const rules = { ...DEFAULT_TOURNAMENT_RULES, protectedSeedCount: 5 };
    const warning = getDrawReadinessWarning(8, rules);
    expect(warning).toContain('cabeça');
  });

  it('returns null when automatic draw seed count equals group count', () => {
    const rules = { ...DEFAULT_TOURNAMENT_RULES, protectedSeedCount: 2 };
    expect(getDrawReadinessWarning(6, rules)).toBeNull();
  });

  it('returns null for explicit 6 players in 2 groups of 3', () => {
    const warning = getDrawReadinessWarning(6, DEFAULT_TOURNAMENT_RULES, {
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
      randomSeed: 'fixed-seed',
      approvedGroups: [{ playerIds: ['a', 'c', 'e'] }, { playerIds: ['b', 'd', 'f'] }],
    });
    expect(warning).toBeNull();
  });

  it('warns when explicit groups no longer fit player count', () => {
    const warning = getDrawReadinessWarning(5, DEFAULT_TOURNAMENT_RULES, {
      groupCount: 2,
      groupSizes: [3, 3],
    });
    expect(warning).toContain('2 grupo(s)');
  });

  it('warns when seeds are missing from explicit plan', () => {
    const warning = getDrawReadinessWarning(6, DEFAULT_TOURNAMENT_RULES, {
      groupCount: 2,
      groupSizes: [3, 3],
    });
    expect(warning).toContain('Seeds');
  });

  it('warns when explicit configuration lost its approved preview', () => {
    const warning = getDrawReadinessWarning(6, DEFAULT_TOURNAMENT_RULES, {
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
    });
    expect(warning).toContain('prévia');
  });
});

describe('canExecuteExplicitDraw', () => {
  it('returns true when draw plan is complete', () => {
    expect(
      canExecuteExplicitDraw({
        groupCount: 2,
        groupSizes: [3, 3],
        seedPlayerIds: ['a', 'b'],
        randomSeed: 'fixed-seed',
        approvedGroups: [{ playerIds: ['a', 'c', 'e'] }, { playerIds: ['b', 'd', 'f'] }],
      }),
    ).toBe(true);
  });

  it('returns false when seeds are missing', () => {
    expect(
      canExecuteExplicitDraw({
        groupCount: 2,
        groupSizes: [3, 3],
      }),
    ).toBe(false);
  });

  it('returns false when the approved preview is missing', () => {
    expect(
      canExecuteExplicitDraw({
        groupCount: 2,
        groupSizes: [3, 3],
        seedPlayerIds: ['a', 'b'],
      }),
    ).toBe(false);
  });
});

describe('resolveEffectiveDrawPlan', () => {
  it('prefers server draw plan and merges draft seeds when missing on server', () => {
    expect(
      resolveEffectiveDrawPlan(
        { groupCount: 2, groupSizes: [3, 3] },
        { seedPlayerIds: ['a', 'b'] },
      ),
    ).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: ['a', 'b'],
    });
  });

  it('falls back to draft when server has no draw plan', () => {
    expect(
      resolveEffectiveDrawPlan(null, {
        groupCount: 2,
        groupSizes: [3, 3],
      }),
    ).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
    });
  });
});
