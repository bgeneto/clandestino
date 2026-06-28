import { type Static, Type } from '@sinclair/typebox';

export const RankingCriterionSchema = Type.Union(
  [
    Type.Literal('SETS_WON'),
    Type.Literal('HEAD_TO_HEAD'),
    Type.Literal('SET_DIFF'),
    Type.Literal('POINTS_DIFF'),
    Type.Literal('MATCHES_WON'),
    Type.Literal('RANDOM_OR_ORGANIZER'),
  ],
  { $id: 'RankingCriterion' },
);

export type RankingCriterion = Static<typeof RankingCriterionSchema>;

export const SeedingMethodSchema = Type.Union(
  [Type.Literal('fixed-heads'), Type.Literal('snake'), Type.Literal('pots')],
  { $id: 'SeedingMethod' },
);

export type SeedingMethod = Static<typeof SeedingMethodSchema>;

export const PlacementStageFormatSchema = Type.Union(
  [Type.Literal('round-robin'), Type.Literal('knockout')],
  { $id: 'PlacementStageFormat' },
);

export type PlacementStageFormat = Static<typeof PlacementStageFormatSchema>;

export const EditionRulesSchema = Type.Object(
  {
    minimumGroupSize: Type.Integer({ minimum: 2 }),
    preferredGroupSize: Type.Integer({ minimum: 2 }),
    maximumGroupSize: Type.Integer({ minimum: 2 }),
    participantThresholdForBestOfThree: Type.Integer({ minimum: 1 }),
    normalMatchBestOf: Type.Union([Type.Literal(3), Type.Literal(5)]),
    protectedSeedCount: Type.Integer({ minimum: 0 }),
    seedingMethod: SeedingMethodSchema,
    groupRankingCriteria: Type.Array(RankingCriterionSchema, { minItems: 1 }),
    placementStageFormat: PlacementStageFormatSchema,
  },
  { $id: 'EditionRules' },
);

export type EditionRules = Static<typeof EditionRulesSchema>;

export const DEFAULT_GROUP_RANKING_CRITERIA: RankingCriterion[] = [
  'SETS_WON',
  'SET_DIFF',
  'MATCHES_WON',
];

export const DEFAULT_EDITION_RULES: EditionRules = {
  minimumGroupSize: 4,
  preferredGroupSize: 5,
  maximumGroupSize: 6,
  participantThresholdForBestOfThree: 24,
  normalMatchBestOf: 5,
  protectedSeedCount: 3,
  seedingMethod: 'fixed-heads',
  groupRankingCriteria: DEFAULT_GROUP_RANKING_CRITERIA,
  placementStageFormat: 'round-robin',
};

/** @deprecated Use DEFAULT_EDITION_RULES */
export const DEFAULT_TOURNAMENT_RULES = DEFAULT_EDITION_RULES;

/** @deprecated Use EditionRulesSchema */
export const TournamentRulesSchema = EditionRulesSchema;

/** @deprecated Use EditionRules */
export type TournamentRules = EditionRules;
