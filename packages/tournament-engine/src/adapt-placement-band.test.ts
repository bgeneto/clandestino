import { describe, expect, it } from 'vitest';
import { adaptPlacementBand, choosePlacementFormat } from './adapt-placement-band.js';

describe('adapt-placement-band', () => {
  it('chooses bracket-4 for four active players', () => {
    expect(choosePlacementFormat(4)).toBe('bracket-4');
  });

  it('reshapes band from four to three players as round-robin', () => {
    const result = adaptPlacementBand(['a', 'b', 'c', 'd'], ['d']);

    expect(result.format).toBe('round-robin');
    expect(result.activePlayerIds).toEqual(['a', 'b', 'c']);
  });

  it('reshapes band from three to two players as knockout', () => {
    const result = adaptPlacementBand(['a', 'b', 'c'], ['c']);

    expect(result.format).toBe('knockout');
    expect(result.activePlayerIds).toEqual(['a', 'b']);
  });
});
