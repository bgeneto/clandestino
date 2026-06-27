export const queryKeys = {
  edition: (editionId: string) => ['edition', editionId] as const,
  registrations: (editionId: string) => ['registrations', editionId] as const,
  participants: (editionId: string) => ['participants', editionId] as const,
  groups: (editionId: string) => ['groups', editionId] as const,
  standings: (editionId: string) => ['standings', editionId] as const,
  matches: (editionId: string, playerId?: string) =>
    ['matches', editionId, playerId ?? 'all'] as const,
  player: (playerId: string) => ['player', playerId] as const,
  seasons: () => ['seasons'] as const,
  players: () => ['players'] as const,
  drawSnapshots: (editionId: string) => ['draw-snapshots', editionId] as const,
  editionQr: (editionId: string) => ['edition-qr', editionId] as const,
  contestedMatches: (editionId: string) => ['contested-matches', editionId] as const,
  finalPlacements: (editionId: string) => ['final-placements', editionId] as const,
};

export type QueryKey = ReturnType<(typeof queryKeys)[keyof typeof queryKeys]>;
