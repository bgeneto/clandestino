import { type Static, Type } from '@sinclair/typebox';
import { UuidSchema } from './common.js';

export const StandingSchema = Type.Object(
  {
    id: UuidSchema,
    groupId: UuidSchema,
    playerId: UuidSchema,
    setsWon: Type.Integer({ minimum: 0 }),
    setDiff: Type.Integer(),
    matchesWon: Type.Integer({ minimum: 0 }),
    rankInGroup: Type.Integer({ minimum: 1 }),
  },
  { $id: 'Standing' },
);

export type Standing = Static<typeof StandingSchema>;

export const GroupStandingsResponseSchema = Type.Object(
  {
    groupId: UuidSchema,
    standings: Type.Array(StandingSchema),
  },
  { $id: 'GroupStandingsResponse' },
);

export type GroupStandingsResponse = Static<typeof GroupStandingsResponseSchema>;

export const EditionStandingsResponseSchema = Type.Object(
  {
    groups: Type.Array(GroupStandingsResponseSchema),
  },
  { $id: 'EditionStandingsResponse' },
);

export type EditionStandingsResponse = Static<typeof EditionStandingsResponseSchema>;
