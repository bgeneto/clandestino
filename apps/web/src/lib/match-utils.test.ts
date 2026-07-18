import { describe, expect, it } from 'vitest';
import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import { validateScoreInput } from './match-utils.js';

describe('validateScoreInput', () => {
  it('rejects tied scores', () => {
    const result = validateScoreInput(2, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('accepts plausible played scores', () => {
    expect(validateScoreInput(2, 0).valid).toBe(true);
    expect(validateScoreInput(2, 1).valid).toBe(true);
    expect(validateScoreInput(3, 1).valid).toBe(true);
    expect(validateScoreInput(3, 2).valid).toBe(true);
    expect(validateScoreInput(4, 3).valid).toBe(true);
  });

  it('rejects incomplete and absurd scores', () => {
    expect(validateScoreInput(1, 0).valid).toBe(false);
    expect(validateScoreInput(0, 1).valid).toBe(false);
    expect(validateScoreInput(MAX_SETS_SCORE + 1, 2).valid).toBe(false);
  });

  it('rejects scores above maximum', () => {
    const result = validateScoreInput(MAX_SETS_SCORE + 1, 3);
    expect(result.valid).toBe(false);
  });
});
