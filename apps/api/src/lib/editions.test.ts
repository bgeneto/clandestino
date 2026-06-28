import { describe, expect, it } from 'vitest';
import { formatEditionName } from './editions.js';

describe('formatEditionName', () => {
  it('formats sequential edition names', () => {
    expect(formatEditionName(1)).toBe('Clandestino #1');
    expect(formatEditionName(42)).toBe('Clandestino #42');
  });
});
