import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, JsonValueSchema, UuidSchema } from './common.js';

export const AuditEventTypeSchema = Type.Union(
  [
    Type.Literal('EDITION_CREATED'),
    Type.Literal('CSV_IMPORTED'),
    Type.Literal('DRAW_EXECUTED'),
    Type.Literal('DRAW_CANCELLED'),
    Type.Literal('MATCH_RESULT_SUBMITTED'),
    Type.Literal('MATCH_CONFIRMED'),
    Type.Literal('MATCH_CONTESTED'),
    Type.Literal('MATCH_CORRECTED'),
    Type.Literal('MATCH_CANCELLED'),
    Type.Literal('AUTO_CONFIRMED'),
    Type.Literal('PLACEMENT_STAGE_GENERATED'),
    Type.Literal('PLACEMENT_STAGE_PUBLISHED'),
    Type.Literal('EDITION_FINALIZED'),
  ],
  { $id: 'AuditEventType' },
);

export type AuditEventType = Static<typeof AuditEventTypeSchema>;

export const AuditEventSchema = Type.Object(
  {
    id: UuidSchema,
    editionId: Type.Union([UuidSchema, Type.Null()]),
    championshipId: Type.Union([UuidSchema, Type.Null()]),
    matchId: Type.Union([UuidSchema, Type.Null()]),
    eventType: AuditEventTypeSchema,
    payload: JsonValueSchema,
    createdAt: IsoDateTimeSchema,
    createdBy: Type.String({ minLength: 1 }),
  },
  { $id: 'AuditEvent' },
);

export type AuditEvent = Static<typeof AuditEventSchema>;

export const AuditEventListResponseSchema = Type.Object(
  {
    events: Type.Array(AuditEventSchema),
  },
  { $id: 'AuditEventListResponse' },
);

export type AuditEventListResponse = Static<typeof AuditEventListResponseSchema>;
