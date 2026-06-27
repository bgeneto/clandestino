import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

export const ScoringTableEntrySchema = Type.Object(
  {
    position: Type.Integer({ minimum: 1 }),
    points: Type.Integer({ minimum: 0 }),
  },
  { $id: 'ScoringTableEntry' },
);

export type ScoringTableEntry = Static<typeof ScoringTableEntrySchema>;

export const ScoringTableSchema = Type.Array(ScoringTableEntrySchema, {
  $id: 'ScoringTable',
});

export type ScoringTable = Static<typeof ScoringTableSchema>;

export const SeasonSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    scoringTable: ScoringTableSchema,
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'Season' },
);

export type Season = Static<typeof SeasonSchema>;

export const CreateSeasonBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    scoringTable: Type.Optional(ScoringTableSchema),
  },
  { $id: 'CreateSeasonBody' },
);

export type CreateSeasonBody = Static<typeof CreateSeasonBodySchema>;

export const UpdateScoringTableBodySchema = Type.Object(
  {
    scoringTable: ScoringTableSchema,
  },
  { $id: 'UpdateScoringTableBody' },
);

export type UpdateScoringTableBody = Static<typeof UpdateScoringTableBodySchema>;

export const SeasonListResponseSchema = Type.Object(
  {
    seasons: Type.Array(SeasonSchema),
  },
  { $id: 'SeasonListResponse' },
);

export type SeasonListResponse = Static<typeof SeasonListResponseSchema>;

/** Default scoring table: 1st=200 … 20th=1; positions beyond 20 receive 0 points. */
export const DEFAULT_SCORING_TABLE: ScoringTable = [
  { position: 1, points: 200 },
  { position: 2, points: 180 },
  { position: 3, points: 160 },
  { position: 4, points: 140 },
  { position: 5, points: 100 },
  { position: 6, points: 90 },
  { position: 7, points: 80 },
  { position: 8, points: 70 },
  { position: 9, points: 50 },
  { position: 10, points: 45 },
  { position: 11, points: 40 },
  { position: 12, points: 35 },
  { position: 13, points: 20 },
  { position: 14, points: 15 },
  { position: 15, points: 10 },
  { position: 16, points: 5 },
  { position: 17, points: 4 },
  { position: 18, points: 3 },
  { position: 19, points: 2 },
  { position: 20, points: 1 },
];
