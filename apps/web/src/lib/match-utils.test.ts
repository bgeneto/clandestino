import { describe, expect, it } from 'vitest';
import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import { validateScoreInput } from './match-utils.js';

describe('validateScoreInput', () => {
  it('rejects tied scores', () => {
    const result = validateScoreInput(2, 2, 3);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('accepts valid best-of-5 scores', () => {
    const result = validateScoreInput(3, 1, 5);
    expect(result.valid).toBe(true);
  });

  it('rejects impossible format scores', () => {
    expect(validateScoreInput(4, 2, 5).valid).toBe(false);
    expect(validateScoreInput(1, 0, 3).valid).toBe(false);
  });

  it('rejects scores above maximum', () => {
    const result = validateScoreInput(MAX_SETS_SCORE + 1, 3, 5);
    expect(result.valid).toBe(false);
  });
});
