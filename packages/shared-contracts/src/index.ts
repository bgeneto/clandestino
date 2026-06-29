export { UuidSchema, IsoDateTimeSchema, IsoDateSchema, JsonValueSchema } from './common.js';

export {
  PlayerSchema,
  CreatePlayerBodySchema,
  PlayerListResponseSchema,
  PLAYER_NAME_MIN_LENGTH,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_DUPLICATE_MESSAGE,
  normalizePlayerName,
  validatePlayerName,
  findDuplicateNormalizedPlayerName,
  type Player,
  type CreatePlayerBody,
  type PlayerListResponse,
  type PlayerNameValidationResult,
} from './player.js';

export {
  ScoringTableEntrySchema,
  ScoringTableSchema,
  ChampionshipSchema,
  CreateChampionshipBodySchema,
  UpdateScoringTableBodySchema,
  ChampionshipListResponseSchema,
  ChampionshipRankingEntrySchema,
  ChampionshipRankingResponseSchema,
  ChampionshipRosterEntrySchema,
  ChampionshipRosterResponseSchema,
  EditionSummarySchema,
  ChampionshipEditionsResponseSchema,
  DeleteChampionshipResponseSchema,
  ArchiveChampionshipResponseSchema,
  UnarchiveChampionshipResponseSchema,
  DEFAULT_SCORING_TABLE,
  type ScoringTableEntry,
  type ScoringTable,
  type Championship,
  type CreateChampionshipBody,
  type UpdateScoringTableBody,
  type ChampionshipListResponse,
  type ChampionshipRankingEntry,
  type ChampionshipRankingResponse,
  type ChampionshipRosterEntry,
  type ChampionshipRosterResponse,
  type EditionSummary,
  type ChampionshipEditionsResponse,
  type DeleteChampionshipResponse,
  type ArchiveChampionshipResponse,
  type UnarchiveChampionshipResponse,
} from './championship.js';

export {
  RankingCriterionSchema,
  SeedingMethodSchema,
  PlacementStageFormatSchema,
  EditionRulesSchema,
  DEFAULT_GROUP_RANKING_CRITERIA,
  DEFAULT_EDITION_RULES,
  DEFAULT_TOURNAMENT_RULES,
  TournamentRulesSchema,
  type RankingCriterion,
  type SeedingMethod,
  type PlacementStageFormat,
  type EditionRules,
  type TournamentRules,
} from './edition-rules.js';

export { formatEditionName } from './edition-naming.js';

export {
  EditionStatusSchema,
  EditionSchema,
  CreateEditionBodySchema,
  EditionRegistrationSchema,
  RegisterPlayerBodySchema,
  EditionRegistrationsResponseSchema,
  type EditionStatus,
  type Edition,
  type CreateEditionBody,
  type EditionRegistration,
  type RegisterPlayerBody,
  type EditionRegistrationsResponse,
  EditionParticipantSchema,
  EditionParticipantsResponseSchema,
  type EditionParticipant,
  type EditionParticipantsResponse,
} from './edition.js';

export {
  GroupSchema,
  GroupPlayerSchema,
  GroupWithPlayersSchema,
  EditionGroupsResponseSchema,
  type Group,
  type GroupPlayer,
  type GroupWithPlayers,
  type EditionGroupsResponse,
} from './group.js';

export {
  MAX_SETS_SCORE,
  MatchStatusSchema,
  MatchParticipantSchema,
  MatchSchema,
  SubmitMatchResultBodySchema,
  MatchResultResponseSchema,
  PlayerMatchesResponseSchema,
  EditionMatchesResponseSchema,
  ContestMatchBodySchema,
  CorrectMatchResultBodySchema,
  ContestedMatchSchema,
  EditionContestedMatchesResponseSchema,
  type MatchStatus,
  type MatchParticipant,
  type Match,
  type SubmitMatchResultBody,
  type MatchResultResponse,
  type PlayerMatchesResponse,
  type EditionMatchesResponse,
  type ContestMatchBody,
  type CorrectMatchResultBody,
  type ContestedMatch,
  type EditionContestedMatchesResponse,
} from './match.js';

export {
  StandingSchema,
  GroupStandingsResponseSchema,
  EditionStandingsResponseSchema,
  type Standing,
  type GroupStandingsResponse,
  type EditionStandingsResponse,
} from './standing.js';

export {
  FinalPlacementSchema,
  EditionFinalPlacementsResponseSchema,
  type FinalPlacement,
  type EditionFinalPlacementsResponse,
} from './final-placement.js';

export {
  DrawSnapshotSchema,
  DrawSnapshotListResponseSchema,
  ExecuteDrawBodySchema,
  type DrawSnapshot,
  type DrawSnapshotListResponse,
  type ExecuteDrawBody,
} from './draw-snapshot.js';

export {
  AuditEventTypeSchema,
  AuditEventSchema,
  AuditEventListResponseSchema,
  type AuditEventType,
  type AuditEvent,
  type AuditEventListResponse,
} from './audit-event.js';

export {
  IMPORT_SCORES_CSV_FORMAT_HINT,
  normalizeCsvHeader,
  resolveImportScoresCsvColumns,
  type ImportScoresCsvColumnIndexes,
} from './csv-import.js';

export {
  ErrorResponseSchema,
  ImportScoresCsvRowSchema,
  ImportScoresResponseSchema,
  SseEventTypeSchema,
  SseEventSchema,
  type SseEventType,
  type SseEvent,
  EditionQrResponseSchema,
  GenerateMatchesResponseSchema,
  PublishPlacementResponseSchema,
  FinalizeEditionResponseSchema,
  type ImportScoresCsvRow,
  type ImportScoresResponse,
  type EditionQrResponse,
  type GenerateMatchesResponse,
  type PublishPlacementResponse,
  type FinalizeEditionResponse,
} from './api.js';

export {
  RequestOrganizerMagicLinkBodySchema,
  RequestOrganizerMagicLinkResponseSchema,
  VerifyOrganizerMagicLinkBodySchema,
  OrganizerSessionResponseSchema,
  OrganizerSessionStatusSchema,
  type RequestOrganizerMagicLinkBody,
  type RequestOrganizerMagicLinkResponse,
  type VerifyOrganizerMagicLinkBody,
  type OrganizerSessionResponse,
  type OrganizerSessionStatus,
} from './auth.js';
