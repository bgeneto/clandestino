import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

export const PlayerSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'Player' },
);

export type Player = Static<typeof PlayerSchema>;

export const CreatePlayerBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
  },
  { $id: 'CreatePlayerBody' },
);

export type CreatePlayerBody = Static<typeof CreatePlayerBodySchema>;

export const PlayerListResponseSchema = Type.Object(
  {
    players: Type.Array(PlayerSchema),
  },
  { $id: 'PlayerListResponse' },
);

export type PlayerListResponse = Static<typeof PlayerListResponseSchema>;
