import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';
import { EditionRulesSchema } from './edition-rules.js';
import { EditionStatusSchema } from './edition.js';

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

export const ChampionshipSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    scoringTable: ScoringTableSchema,
    defaultEditionRules: Type.Optional(EditionRulesSchema),
    archivedAt: Type.Optional(IsoDateTimeSchema),
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'Championship' },
);

export type Championship = Static<typeof ChampionshipSchema>;

export const CreateChampionshipBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    scoringTable: Type.Optional(ScoringTableSchema),
    defaultEditionRules: Type.Optional(EditionRulesSchema),
  },
  { $id: 'CreateChampionshipBody' },
);

export type CreateChampionshipBody = Static<typeof CreateChampionshipBodySchema>;

export const UpdateScoringTableBodySchema = Type.Object(
  {
    scoringTable: ScoringTableSchema,
  },
  { $id: 'UpdateScoringTableBody' },
);

export type UpdateScoringTableBody = Static<typeof UpdateScoringTableBodySchema>;

export const ChampionshipListResponseSchema = Type.Object(
  {
    championships: Type.Array(ChampionshipSchema),
  },
  { $id: 'ChampionshipListResponse' },
);

export type ChampionshipListResponse = Static<typeof ChampionshipListResponseSchema>;

export const ChampionshipRankingEntrySchema = Type.Object(
  {
    playerId: UuidSchema,
    playerName: Type.String({ minLength: 1 }),
    accumulatedPoints: Type.Integer({ minimum: 0 }),
    rank: Type.Integer({ minimum: 1 }),
  },
  { $id: 'ChampionshipRankingEntry' },
);

export type ChampionshipRankingEntry = Static<typeof ChampionshipRankingEntrySchema>;

export const ChampionshipRankingResponseSchema = Type.Object(
  {
    championshipId: UuidSchema,
    ranking: Type.Array(ChampionshipRankingEntrySchema),
  },
  { $id: 'ChampionshipRankingResponse' },
);

export type ChampionshipRankingResponse = Static<typeof ChampionshipRankingResponseSchema>;

export const ChampionshipRosterEntrySchema = Type.Object(
  {
    playerId: UuidSchema,
    playerName: Type.String({ minLength: 1 }),
    accumulatedPoints: Type.Integer({ minimum: 0 }),
  },
  { $id: 'ChampionshipRosterEntry' },
);

export type ChampionshipRosterEntry = Static<typeof ChampionshipRosterEntrySchema>;

export const ChampionshipRosterResponseSchema = Type.Object(
  {
    championshipId: UuidSchema,
    roster: Type.Array(ChampionshipRosterEntrySchema),
  },
  { $id: 'ChampionshipRosterResponse' },
);

export type ChampionshipRosterResponse = Static<typeof ChampionshipRosterResponseSchema>;

export const EditionSummarySchema = Type.Object(
  {
    id: UuidSchema,
    championshipId: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    date: Type.String({ format: 'date' }),
    status: EditionStatusSchema,
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'EditionSummary' },
);

export type EditionSummary = Static<typeof EditionSummarySchema>;

export const ChampionshipEditionsResponseSchema = Type.Object(
  {
    championshipId: UuidSchema,
    editions: Type.Array(EditionSummarySchema),
  },
  { $id: 'ChampionshipEditionsResponse' },
);

export type ChampionshipEditionsResponse = Static<typeof ChampionshipEditionsResponseSchema>;

export const OrganizerActiveEditionSchema = Type.Object(
  {
    id: UuidSchema,
    championshipId: UuidSchema,
    championshipName: Type.String({ minLength: 1, maxLength: 120 }),
    name: Type.String({ minLength: 1, maxLength: 120 }),
    date: Type.String({ format: 'date' }),
    status: EditionStatusSchema,
    contestedMatchCount: Type.Integer({ minimum: 0 }),
    placementGroupCount: Type.Integer({ minimum: 0 }),
    needsOrganizerAction: Type.Boolean(),
    actionLabel: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  },
  { $id: 'OrganizerActiveEdition' },
);

export type OrganizerActiveEdition = Static<typeof OrganizerActiveEditionSchema>;

export const OrganizerActiveEditionsResponseSchema = Type.Object(
  {
    editions: Type.Array(OrganizerActiveEditionSchema),
  },
  { $id: 'OrganizerActiveEditionsResponse' },
);

export type OrganizerActiveEditionsResponse = Static<typeof OrganizerActiveEditionsResponseSchema>;

export const DeleteChampionshipResponseSchema = Type.Object(
  {
    id: UuidSchema,
    deletedAt: IsoDateTimeSchema,
  },
  { $id: 'DeleteChampionshipResponse' },
);

export type DeleteChampionshipResponse = Static<typeof DeleteChampionshipResponseSchema>;

export const ArchiveChampionshipResponseSchema = Type.Object(
  {
    id: UuidSchema,
    archivedAt: IsoDateTimeSchema,
  },
  { $id: 'ArchiveChampionshipResponse' },
);

export type ArchiveChampionshipResponse = Static<typeof ArchiveChampionshipResponseSchema>;

export const UnarchiveChampionshipResponseSchema = Type.Object(
  {
    id: UuidSchema,
    archivedAt: Type.Null(),
  },
  { $id: 'UnarchiveChampionshipResponse' },
);

export type UnarchiveChampionshipResponse = Static<typeof UnarchiveChampionshipResponseSchema>;

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
