import { type Static, Type } from '@sinclair/typebox';
import { IsoDateSchema, JsonValueSchema, UuidSchema } from './common.js';
import { PLAYER_NAME_MIN_LENGTH } from './player.js';
import { EditionSchema } from './edition.js';
import { EditionFinalPlacementsResponseSchema } from './final-placement.js';
import { GroupWithPlayersSchema } from './group.js';

export const ErrorResponseSchema = Type.Object(
  {
    error: Type.String(),
    details: Type.Optional(JsonValueSchema),
  },
  { $id: 'ErrorResponse' },
);

export const ImportScoresCsvRowSchema = Type.Object(
  {
    playerName: Type.String({ minLength: PLAYER_NAME_MIN_LENGTH }),
    accumulatedPoints: Type.Integer({ minimum: 0 }),
  },
  { $id: 'ImportScoresCsvRow' },
);

export type ImportScoresCsvRow = Static<typeof ImportScoresCsvRowSchema>;

export const ImportScoresResponseSchema = Type.Object(
  {
    championshipId: Type.String({ format: 'uuid' }),
    importedCount: Type.Integer({ minimum: 0 }),
    createdPlayersCount: Type.Integer({ minimum: 0 }),
    skippedExistingCount: Type.Integer({ minimum: 0 }),
    scores: Type.Array(ImportScoresCsvRowSchema),
  },
  { $id: 'ImportScoresResponse' },
);

export type ImportScoresResponse = Static<typeof ImportScoresResponseSchema>;

export const SseEventTypeSchema = Type.Union(
  [
    Type.Literal('match_confirmed'),
    Type.Literal('match_result_submitted'),
    Type.Literal('phase_published'),
    Type.Literal('match_contested'),
    Type.Literal('player_withdrawn'),
  ],
  { $id: 'SseEventType' },
);

export type SseEventType = Static<typeof SseEventTypeSchema>;

/** Campos abreviados no wire SSE: m=matchId, g=groupId, p=playerId, n=count */
export const SseWireDataSchema = Type.Object(
  {
    m: Type.Optional(Type.String({ format: 'uuid' })),
    g: Type.Optional(Type.String({ format: 'uuid' })),
    p: Type.Optional(Type.String({ format: 'uuid' })),
    n: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { $id: 'SseWireData' },
);

export type SseWireData = Static<typeof SseWireDataSchema>;

export const EditionSyncStateSchema = Type.Object(
  {
    editionId: UuidSchema,
    syncRevision: Type.Integer({ minimum: 0 }),
  },
  { $id: 'EditionSyncState' },
);

export type EditionSyncState = Static<typeof EditionSyncStateSchema>;

export const EditionQrResponseSchema = Type.Object(
  {
    editionId: UuidSchema,
    url: Type.String({ minLength: 1 }),
    editionName: Type.String({ minLength: 1 }),
    editionDate: IsoDateSchema,
  },
  { $id: 'EditionQrResponse' },
);

export type EditionQrResponse = Static<typeof EditionQrResponseSchema>;

export const GenerateMatchesResponseSchema = Type.Object(
  {
    edition: EditionSchema,
    matchesGenerated: Type.Integer({ minimum: 0 }),
  },
  { $id: 'GenerateMatchesResponse' },
);

export type GenerateMatchesResponse = Static<typeof GenerateMatchesResponseSchema>;

export const PublishPlacementResponseSchema = Type.Object(
  {
    edition: EditionSchema,
    groups: Type.Array(GroupWithPlayersSchema),
    matchesGenerated: Type.Integer({ minimum: 0 }),
  },
  { $id: 'PublishPlacementResponse' },
);

export type PublishPlacementResponse = Static<typeof PublishPlacementResponseSchema>;

export const FinalizeEditionResponseSchema = Type.Object(
  {
    edition: EditionSchema,
    placements: EditionFinalPlacementsResponseSchema.properties.placements,
  },
  { $id: 'FinalizeEditionResponse' },
);

export type FinalizeEditionResponse = Static<typeof FinalizeEditionResponseSchema>;
