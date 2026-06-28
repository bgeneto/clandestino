export type {
  GroupConfiguration,
  SeedAssignment,
  DrawGroupPlayer,
  DrawGroupInput,
  GroupMatch,
  GroupForMatches,
  MatchResultInput,
  MatchValidationResult,
  StandingMatch,
  PlayerMatchStats,
  GroupStandingEntry,
  GroupStandingInput,
  PlacementStageGroup,
  PlacementGroupResult,
  FinalStandingEntry,
  RankingCriterion,
  TournamentRules,
} from './types.js';

export { COUNTED_MATCH_STATUSES } from './types.js';

export {
  WIZARD_MIN_GROUP_SIZE,
  WIZARD_WARN_GROUP_SIZE,
  WIZARD_BEST_OF_THREE_MATCH_THRESHOLD,
  maxGroupCount,
  partitionPlayersIntoGroups,
  estimateRoundRobinMatches,
  buildGroupConfiguration,
  suggestGroupCount,
  recommendMatchBestOf,
  selectDefaultSeeds,
  type SeedCandidate,
} from './group-planning.js';
export {
  executeExplicitDraw,
  buildGroupName,
  type ExplicitDrawGroupResult,
  type ExplicitDrawResult,
} from './execute-explicit-draw.js';
export { chooseGroupConfiguration } from './choose-group-configuration.js';
export { allocateSeededPlayers } from './allocate-seeded-players.js';
export { drawUnseededPlayers } from './draw-unseeded-players.js';
export { generateGroupMatches } from './generate-group-matches.js';
export {
  validateMatchResult,
  getMatchBestOf,
  validScoresForBestOf,
  invalidScoresForBestOf,
} from './validate-match-result.js';
export { calculateGroupStanding } from './calculate-group-standing.js';
export { resolveTies } from './resolve-ties.js';
export {
  generatePlacementStage,
  directPlacementsFromStandings,
} from './generate-placement-stage.js';
export {
  calculateFinalStanding,
  attachScoringPoints,
  pointsForPosition,
} from './calculate-final-standing.js';

export { createSeededRng, hashSeed, shuffle } from './rng.js';
