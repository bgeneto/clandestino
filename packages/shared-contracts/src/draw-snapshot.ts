import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, JsonValueSchema, UuidSchema } from './common.js';

export const DrawSnapshotSchema = Type.Object(
  {
    id: UuidSchema,
    editionId: UuidSchema,
    playerId: UuidSchema,
    accumulatedPoints: Type.Integer({ minimum: 0 }),
    rankPosition: Type.Integer({ minimum: 1 }),
    isSeed: Type.Boolean(),
    algorithm: Type.String({ minLength: 1 }),
    randomSeed: Type.String({ minLength: 1 }),
    drawnAt: IsoDateTimeSchema,
    drawnBy: Type.String({ minLength: 1 }),
  },
  { $id: 'DrawSnapshot' },
);

export type DrawSnapshot = Static<typeof DrawSnapshotSchema>;

export const DrawSnapshotListResponseSchema = Type.Object(
  {
    snapshots: Type.Array(DrawSnapshotSchema),
  },
  { $id: 'DrawSnapshotListResponse' },
);

export type DrawSnapshotListResponse = Static<typeof DrawSnapshotListResponseSchema>;

export const ApprovedDrawGroupSchema = Type.Object(
  {
    playerIds: Type.Array(UuidSchema, { minItems: 2, uniqueItems: true }),
  },
  { $id: 'ApprovedDrawGroup' },
);

export type ApprovedDrawGroup = Static<typeof ApprovedDrawGroupSchema>;

export const EditionDrawPlanSchema = Type.Object(
  {
    groupCount: Type.Optional(Type.Integer({ minimum: 1 })),
    groupSizes: Type.Optional(Type.Array(Type.Integer({ minimum: 2 }), { minItems: 1 })),
    seedPlayerIds: Type.Optional(Type.Array(UuidSchema, { minItems: 1 })),
    randomSeed: Type.Optional(Type.String({ minLength: 1 })),
    approvedGroups: Type.Optional(Type.Array(ApprovedDrawGroupSchema, { minItems: 1 })),
  },
  { $id: 'EditionDrawPlan' },
);

export type EditionDrawPlan = Static<typeof EditionDrawPlanSchema>;

export const ExecuteDrawBodySchema = Type.Object(
  {
    randomSeed: Type.Optional(Type.String({ minLength: 1 })),
    groupCount: Type.Optional(Type.Integer({ minimum: 1 })),
    groupSizes: Type.Optional(Type.Array(Type.Integer({ minimum: 2 }), { minItems: 1 })),
    seedPlayerIds: Type.Optional(Type.Array(UuidSchema, { minItems: 1 })),
    approvedGroups: Type.Optional(Type.Array(ApprovedDrawGroupSchema, { minItems: 1 })),
  },
  { $id: 'ExecuteDrawBody' },
);

export type ExecuteDrawBody = Static<typeof ExecuteDrawBodySchema>;
