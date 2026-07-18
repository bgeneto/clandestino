import { type Static, Type } from '@sinclair/typebox';
import { UuidSchema } from './common.js';
import { PlacementFormatSchema } from './placement.js';

export const GroupSchema = Type.Object(
  {
    id: UuidSchema,
    editionId: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 32 }),
    phase: Type.String({ minLength: 1, maxLength: 64 }),
    placementFormat: Type.Optional(PlacementFormatSchema),
    bracketSeed: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
    positionFrom: Type.Optional(Type.Integer({ minimum: 1 })),
    positionTo: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { $id: 'Group' },
);

export type Group = Static<typeof GroupSchema>;

export const GroupPlayerSchema = Type.Object(
  {
    groupId: UuidSchema,
    playerId: UuidSchema,
    phase: Type.String({ minLength: 1, maxLength: 64 }),
    isSeed: Type.Boolean(),
  },
  { $id: 'GroupPlayer' },
);

export type GroupPlayer = Static<typeof GroupPlayerSchema>;

export const GroupWithPlayersSchema = Type.Object(
  {
    group: GroupSchema,
    players: Type.Array(GroupPlayerSchema),
  },
  { $id: 'GroupWithPlayers' },
);

export type GroupWithPlayers = Static<typeof GroupWithPlayersSchema>;

export const EditionGroupsResponseSchema = Type.Object(
  {
    groups: Type.Array(GroupWithPlayersSchema),
  },
  { $id: 'EditionGroupsResponse' },
);

export type EditionGroupsResponse = Static<typeof EditionGroupsResponseSchema>;
