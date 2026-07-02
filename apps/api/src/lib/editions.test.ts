import { describe, expect, it } from 'vitest';
import { formatEditionName, isPendingEditionName, pendingEditionName } from './editions.js';

describe('formatEditionName', () => {
  it('formats sequential edition names', () => {
    expect(formatEditionName(1)).toBe('Clandestino #1');
    expect(formatEditionName(42)).toBe('Clandestino #42');
  });
});

describe('pendingEditionName', () => {
  it('creates and detects pending names', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const name = pendingEditionName(id);
    expect(name).toBe(`__pending__${id}`);
    expect(isPendingEditionName(name)).toBe(true);
    expect(isPendingEditionName('Clandestino #1')).toBe(false);
  });
});
