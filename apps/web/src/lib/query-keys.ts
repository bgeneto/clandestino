export const queryKeys = {
  edition: (editionId: string) => ['edition', editionId] as const,
  registrations: (editionId: string) => ['registrations', editionId] as const,
  participants: (editionId: string) => ['participants', editionId] as const,
  groups: (editionId: string) => ['groups', editionId] as const,
  standings: (editionId: string) => ['standings', editionId] as const,
  matches: (editionId: string, playerId?: string) =>
    ['matches', editionId, playerId ?? 'all'] as const,
  player: (playerId: string) => ['player', playerId] as const,
};

export type QueryKey = ReturnType<(typeof queryKeys)[keyof typeof queryKeys]>;
