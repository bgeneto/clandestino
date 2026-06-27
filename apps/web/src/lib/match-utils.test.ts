import { describe, expect, it } from 'vitest';
import { validateScoreInput } from './match-utils.js';

describe('validateScoreInput', () => {
  it('rejects 2x2 in best of 3', () => {
    const result = validateScoreInput(2, 2, 3);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('accepts 2x1 in best of 3', () => {
    const result = validateScoreInput(2, 1, 3);
    expect(result.valid).toBe(true);
  });
});
