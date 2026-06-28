import { describe, expect, it } from 'vitest';
import { MAX_SETS_SCORE } from '@clandestino/shared-contracts';
import { validateScoreInput } from './match-utils.js';

describe('validateScoreInput', () => {
  it('rejects tied scores', () => {
    const result = validateScoreInput(2, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('accepts valid scores', () => {
    const result = validateScoreInput(4, 2);
    expect(result.valid).toBe(true);
  });

  it('rejects scores above maximum', () => {
    const result = validateScoreInput(MAX_SETS_SCORE + 1, 3);
    expect(result.valid).toBe(false);
  });
});
