import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import {
  DEFAULT_SCORING_TABLE,
  DEFAULT_TOURNAMENT_RULES,
  type EditionDrawPlan,
  type EditionRules,
  type MatchOutcome,
  type MatchStatus,
  type PlacementFormat,
  type ScoringTable,
} from '@clandestino/shared-contracts';

const MATCH_OUTCOMES = ['PLAYED', 'WALKOVER'] as const;
const BRACKET_ROUNDS = ['SEMIFINAL', 'FINAL', 'THIRD_PLACE'] as const;
const PLACEMENT_FORMATS = ['round-robin', 'knockout', 'bracket-4'] as const;
const WITHDRAWN_PHASES = ['GROUP_STAGE', 'PLACEMENT_STAGE'] as const;

const MATCH_STATUSES = [
  'AGENDADA',
  'AGUARDANDO_CONFIRMACAO',
  'CONFIRMADA',
  'CONTESTADA',
  'CORRIGIDA',
  'CANCELADA',
] as const;

const EDITION_STATUSES = [
  'RASCUNHO',
  'INSCRICOES_ABERTAS',
  'SORTEIO_PUBLICADO',
  'EM_ANDAMENTO',
  'FASE_COLOCACAO',
  'ENCERRADA',
] as const;

const createdAt = integer('created_at', { mode: 'timestamp_ms' })
  .notNull()
  .$defaultFn(() => new Date());

export const players = sqliteTable(
  'player',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    createdAt,
  },
  (table) => [uniqueIndex('player_name_unique').on(table.name)],
);

export const championships = sqliteTable(
  'championship',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    scoringTable: text('scoring_table', { mode: 'json' })
      .$type<ScoringTable>()
      .notNull()
      .default(DEFAULT_SCORING_TABLE),
    defaultEditionRules: text('default_edition_rules', { mode: 'json' }).$type<EditionRules>(),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt,
  },
  (table) => [
    uniqueIndex('championship_name_unique').on(table.name),
    check('championship_scoring_table_is_array', sql`json_type(${table.scoringTable}) = 'array'`),
  ],
);

export const editions = sqliteTable(
  'edition',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    championshipId: text('championship_id')
      .notNull()
      .references(() => championships.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    date: text('date').notNull(),
    rules: text('rules', { mode: 'json' })
      .$type<EditionRules>()
      .notNull()
      .default(DEFAULT_TOURNAMENT_RULES),
    drawPlan: text('draw_plan', { mode: 'json' }).$type<EditionDrawPlan | null>(),
    status: text('status', { enum: EDITION_STATUSES }).notNull().default('RASCUNHO'),
    autoConfirmMinutes: integer('auto_confirm_minutes').notNull().default(15),
    createdAt,
  },
  (table) => [
    uniqueIndex('edition_championship_name_unique').on(table.championshipId, table.name),
    check('edition_rules_is_object', sql`json_type(${table.rules}) = 'object'`),
    check('edition_auto_confirm_minutes_positive', sql`${table.autoConfirmMinutes} > 0`),
  ],
);

export const editionRegistrations = sqliteTable(
  'edition_registration',
  {
    editionId: text('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    registeredAt: integer('registered_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    withdrawnAt: integer('withdrawn_at', { mode: 'timestamp_ms' }),
    withdrawnDuringPhase: text('withdrawn_during_phase', { enum: WITHDRAWN_PHASES }),
  },
  (table) => [
    primaryKey({
      name: 'edition_registration_pk',
      columns: [table.editionId, table.playerId],
    }),
  ],
);

export const drawSnapshots = sqliteTable(
  'draw_snapshot',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    editionId: text('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    accumulatedPoints: integer('accumulated_points').notNull(),
    rankPosition: integer('rank_position').notNull(),
    isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
    algorithm: text('algorithm').notNull(),
    randomSeed: text('random_seed').notNull(),
    drawnAt: integer('drawn_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    drawnBy: text('drawn_by').notNull(),
  },
  (table) => [
    uniqueIndex('draw_snapshot_edition_player_unique').on(table.editionId, table.playerId),
    uniqueIndex('draw_snapshot_edition_rank_unique').on(table.editionId, table.rankPosition),
    check('draw_snapshot_accumulated_points_non_negative', sql`${table.accumulatedPoints} >= 0`),
    check('draw_snapshot_rank_position_positive', sql`${table.rankPosition} > 0`),
  ],
);

export const groups = sqliteTable(
  'group',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    editionId: text('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    phase: text('phase').notNull(),
    placementFormat: text('placement_format', { enum: PLACEMENT_FORMATS }).$type<PlacementFormat>(),
    bracketSeed: text('bracket_seed'),
    positionFrom: integer('position_from'),
    positionTo: integer('position_to'),
  },
  (table) => [
    uniqueIndex('group_edition_phase_name_unique').on(table.editionId, table.phase, table.name),
    unique('group_id_edition_unique').on(table.id, table.editionId),
    unique('group_id_edition_phase_unique').on(table.id, table.editionId, table.phase),
  ],
);

export const groupPlayers = sqliteTable(
  'group_player',
  {
    groupId: text('group_id').notNull(),
    editionId: text('edition_id').notNull(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ name: 'group_player_pk', columns: [table.groupId, table.playerId] }),
    foreignKey({
      name: 'group_player_group_edition_fk',
      columns: [table.groupId, table.editionId],
      foreignColumns: [groups.id, groups.editionId],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('group_player_edition_player_unique').on(table.editionId, table.playerId),
  ],
);

export const matches = sqliteTable(
  'match',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    editionId: text('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    groupId: text('group_id').notNull(),
    phase: text('phase').notNull(),
    playerOneId: text('player_one_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    playerTwoId: text('player_two_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: text('status', { enum: MATCH_STATUSES })
      .$type<MatchStatus>()
      .notNull()
      .default('AGENDADA'),
    outcome: text('outcome', { enum: MATCH_OUTCOMES })
      .$type<MatchOutcome>()
      .notNull()
      .default('PLAYED'),
    bracketRound: text('bracket_round', { enum: BRACKET_ROUNDS }),
    walkoverAbsentPlayerId: text('walkover_absent_player_id').references(() => players.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    createdAt,
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: 'match_group_edition_phase_fk',
      columns: [table.groupId, table.editionId, table.phase],
      foreignColumns: [groups.id, groups.editionId, groups.phase],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('match_edition_phase_players_unique').on(
      table.editionId,
      table.phase,
      table.playerOneId,
      table.playerTwoId,
    ),
    index('match_edition_status_idx').on(table.editionId, table.status),
    check('match_players_ordered', sql`${table.playerOneId} < ${table.playerTwoId}`),
  ],
);

export const matchParticipants = sqliteTable(
  'match_participant',
  {
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    setsWon: integer('sets_won').notNull().default(0),
  },
  (table) => [
    primaryKey({ name: 'match_participant_pk', columns: [table.matchId, table.playerId] }),
    check('match_participant_sets_won_non_negative', sql`${table.setsWon} >= 0`),
    check('match_participant_sets_won_max', sql`${table.setsWon} <= 7`),
  ],
);

export const standings = sqliteTable(
  'standing',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    setsWon: integer('sets_won').notNull().default(0),
    setDiff: integer('set_diff').notNull().default(0),
    matchesWon: integer('matches_won').notNull().default(0),
    rankInGroup: integer('rank_in_group').notNull(),
  },
  (table) => [
    uniqueIndex('standing_group_player_unique').on(table.groupId, table.playerId),
    uniqueIndex('standing_group_rank_unique').on(table.groupId, table.rankInGroup),
    check('standing_sets_won_non_negative', sql`${table.setsWon} >= 0`),
    check('standing_matches_won_non_negative', sql`${table.matchesWon} >= 0`),
    check('standing_rank_in_group_positive', sql`${table.rankInGroup} > 0`),
  ],
);

export const finalPlacements = sqliteTable(
  'final_placement',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    editionId: text('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    position: integer('position').notNull(),
    pointsAwarded: integer('points_awarded').notNull(),
  },
  (table) => [
    uniqueIndex('final_placement_edition_player_unique').on(table.editionId, table.playerId),
    uniqueIndex('final_placement_edition_position_unique').on(table.editionId, table.position),
    check('final_placement_position_positive', sql`${table.position} > 0`),
    check('final_placement_points_awarded_non_negative', sql`${table.pointsAwarded} >= 0`),
  ],
);

export const championshipPlayerPoints = sqliteTable(
  'championship_player_points',
  {
    championshipId: text('championship_id')
      .notNull()
      .references(() => championships.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    accumulatedPoints: integer('accumulated_points').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({
      name: 'championship_player_points_pk',
      columns: [table.championshipId, table.playerId],
    }),
    check('championship_player_points_non_negative', sql`${table.accumulatedPoints} >= 0`),
  ],
);

export const organizerMagicTokens = sqliteTable(
  'organizer_magic_token',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdAt,
  },
  (table) => [
    uniqueIndex('organizer_magic_token_hash_unique').on(table.tokenHash),
    index('organizer_magic_token_email_idx').on(table.email),
  ],
);

export const organizerSessions = sqliteTable(
  'organizer_session',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex('organizer_session_token_hash_unique').on(table.tokenHash),
    index('organizer_session_email_idx').on(table.email),
  ],
);

export const auditEvents = sqliteTable(
  'audit_event',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    editionId: text('edition_id').references(() => editions.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    championshipId: text('championship_id').references(() => championships.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    matchId: text('match_id').references(() => matches.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    eventType: text('event_type').notNull(),
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull().default({}),
    createdAt,
    createdBy: text('created_by').notNull(),
  },
  (table) => [
    index('audit_event_edition_created_at_idx').on(table.editionId, table.createdAt),
    index('audit_event_championship_created_at_idx').on(table.championshipId, table.createdAt),
    check('audit_event_payload_is_object', sql`json_type(${table.payload}) = 'object'`),
    check(
      'audit_event_scope_required',
      sql`${table.editionId} IS NOT NULL OR ${table.championshipId} IS NOT NULL`,
    ),
  ],
);

export const playerRelations = relations(players, ({ many }) => ({
  registrations: many(editionRegistrations),
  groupPlayers: many(groupPlayers),
  matchParticipants: many(matchParticipants),
  finalPlacements: many(finalPlacements),
}));

export const championshipRelations = relations(championships, ({ many }) => ({
  editions: many(editions),
  playerPoints: many(championshipPlayerPoints),
}));

export const championshipPlayerPointsRelations = relations(championshipPlayerPoints, ({ one }) => ({
  championship: one(championships, {
    fields: [championshipPlayerPoints.championshipId],
    references: [championships.id],
  }),
  player: one(players, {
    fields: [championshipPlayerPoints.playerId],
    references: [players.id],
  }),
}));

export const editionRelations = relations(editions, ({ one, many }) => ({
  championship: one(championships, {
    fields: [editions.championshipId],
    references: [championships.id],
  }),
  registrations: many(editionRegistrations),
  groups: many(groups),
  drawSnapshots: many(drawSnapshots),
  matches: many(matches),
  finalPlacements: many(finalPlacements),
  auditEvents: many(auditEvents),
}));

export const groupRelations = relations(groups, ({ one, many }) => ({
  edition: one(editions, {
    fields: [groups.editionId],
    references: [editions.id],
  }),
  players: many(groupPlayers),
  matches: many(matches),
  standings: many(standings),
}));

export const matchRelations = relations(matches, ({ one, many }) => ({
  edition: one(editions, {
    fields: [matches.editionId],
    references: [editions.id],
  }),
  group: one(groups, {
    fields: [matches.groupId],
    references: [groups.id],
  }),
  playerOne: one(players, {
    fields: [matches.playerOneId],
    references: [players.id],
  }),
  playerTwo: one(players, {
    fields: [matches.playerTwoId],
    references: [players.id],
  }),
  participants: many(matchParticipants),
  auditEvents: many(auditEvents),
}));

export const groupPlayerRelations = relations(groupPlayers, ({ one }) => ({
  group: one(groups, {
    fields: [groupPlayers.groupId],
    references: [groups.id],
  }),
  player: one(players, {
    fields: [groupPlayers.playerId],
    references: [players.id],
  }),
}));

export const matchParticipantRelations = relations(matchParticipants, ({ one }) => ({
  match: one(matches, {
    fields: [matchParticipants.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [matchParticipants.playerId],
    references: [players.id],
  }),
}));
