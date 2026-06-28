import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

export const PLAYER_NAME_MIN_LENGTH = 2;
export const PLAYER_NAME_MAX_LENGTH = 120;

export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export type PlayerNameValidationResult = { ok: true; name: string } | { ok: false; error: string };

export function validatePlayerName(name: string): PlayerNameValidationResult {
  const normalized = normalizePlayerName(name);

  if (normalized.length < PLAYER_NAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `Nome deve ter ao menos ${PLAYER_NAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (normalized.length > PLAYER_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Nome deve ter no máximo ${PLAYER_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, name: normalized };
}

export const PlayerSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: PLAYER_NAME_MIN_LENGTH, maxLength: PLAYER_NAME_MAX_LENGTH }),
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'Player' },
);

export type Player = Static<typeof PlayerSchema>;

export const CreatePlayerBodySchema = Type.Object(
  {
    name: Type.String({ minLength: PLAYER_NAME_MIN_LENGTH, maxLength: PLAYER_NAME_MAX_LENGTH }),
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
