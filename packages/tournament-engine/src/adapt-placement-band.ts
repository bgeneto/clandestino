import type { PlacementFormat } from './types.js';

export function choosePlacementFormat(activePlayerCount: number): PlacementFormat {
  if (activePlayerCount === 4) {
    return 'bracket-4';
  }
  if (activePlayerCount >= 3) {
    return 'round-robin';
  }
  return 'knockout';
}

export interface AdaptPlacementBandResult {
  format: PlacementFormat;
  activePlayerIds: string[];
}

export function adaptPlacementBand(
  allPlayerIds: string[],
  withdrawnPlayerIds: readonly string[],
): AdaptPlacementBandResult {
  const withdrawn = new Set(withdrawnPlayerIds);
  const activePlayerIds = allPlayerIds.filter((playerId) => !withdrawn.has(playerId));

  return {
    format: choosePlacementFormat(activePlayerIds.length),
    activePlayerIds,
  };
}
