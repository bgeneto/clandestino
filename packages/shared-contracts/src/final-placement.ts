import { type Static, Type } from '@sinclair/typebox';
import { UuidSchema } from './common.js';

export const FinalPlacementSchema = Type.Object(
  {
    id: UuidSchema,
    editionId: UuidSchema,
    playerId: UuidSchema,
    position: Type.Integer({ minimum: 1 }),
    pointsAwarded: Type.Integer({ minimum: 0 }),
  },
  { $id: 'FinalPlacement' },
);

export type FinalPlacement = Static<typeof FinalPlacementSchema>;

export const EditionFinalPlacementsResponseSchema = Type.Object(
  {
    placements: Type.Array(FinalPlacementSchema),
  },
  { $id: 'EditionFinalPlacementsResponse' },
);

export type EditionFinalPlacementsResponse = Static<typeof EditionFinalPlacementsResponseSchema>;
