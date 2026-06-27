import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  DEFAULT_SCORING_TABLE,
  DEFAULT_TOURNAMENT_RULES,
  type MatchStatus,
  type ScoringTable,
  type TournamentRules,
} from '@clandestino/shared-contracts';

export const matchStatusEnum = pgEnum('match_status', [
  'AGENDADA',
  'AGUARDANDO_CONFIRMACAO',
  'CONFIRMADA',
  'CONTESTADA',
  'CORRIGIDA',
  'CANCELADA',
]);

export const editionStatusEnum = pgEnum('edition_status', [
  'RASCUNHO',
  'INSCRICOES_ABERTAS',
  'SORTEIO_PUBLICADO',
  'EM_ANDAMENTO',
  'FASE_COLOCACAO',
  'ENCERRADA',
]);

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const players = pgTable(
  'player',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    createdAt,
  },
  (table) => [uniqueIndex('player_name_unique').on(table.name)],
);

export const seasons = pgTable(
  'season',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    scoringTable: jsonb('scoring_table')
      .$type<ScoringTable>()
      .notNull()
      .default(DEFAULT_SCORING_TABLE),
    createdAt,
  },
  (table) => [
    uniqueIndex('season_name_unique').on(table.name),
    check('season_scoring_table_is_array', sql`jsonb_typeof(${table.scoringTable}) = 'array'`),
  ],
);

export const editions = pgTable(
  'edition',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    date: date('date').notNull(),
    rules: jsonb('rules').$type<TournamentRules>().notNull().default(DEFAULT_TOURNAMENT_RULES),
    status: editionStatusEnum('status').notNull().default('RASCUNHO'),
    autoConfirmMinutes: integer('auto_confirm_minutes').notNull().default(15),
    createdAt,
  },
  (table) => [
    uniqueIndex('edition_season_name_unique').on(table.seasonId, table.name),
    check('edition_rules_is_object', sql`jsonb_typeof(${table.rules}) = 'object'`),
    check('edition_auto_confirm_minutes_positive', sql`${table.autoConfirmMinutes} > 0`),
  ],
);

export const editionRegistrations = pgTable(
  'edition_registration',
  {
    editionId: uuid('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'edition_registration_pk',
      columns: [table.editionId, table.playerId],
    }),
  ],
);

export const drawSnapshots = pgTable(
  'draw_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    accumulatedPoints: integer('accumulated_points').notNull(),
    rankPosition: integer('rank_position').notNull(),
    isSeed: boolean('is_seed').notNull().default(false),
    algorithm: varchar('algorithm', { length: 120 }).notNull(),
    randomSeed: varchar('random_seed', { length: 120 }).notNull(),
    drawnAt: timestamp('drawn_at', { withTimezone: true }).notNull().defaultNow(),
    drawnBy: varchar('drawn_by', { length: 120 }).notNull(),
  },
  (table) => [
    uniqueIndex('draw_snapshot_edition_player_unique').on(table.editionId, table.playerId),
    uniqueIndex('draw_snapshot_edition_rank_unique').on(table.editionId, table.rankPosition),
    check('draw_snapshot_accumulated_points_non_negative', sql`${table.accumulatedPoints} >= 0`),
    check('draw_snapshot_rank_position_positive', sql`${table.rankPosition} > 0`),
  ],
);

export const groups = pgTable(
  'group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: varchar('name', { length: 32 }).notNull(),
    phase: varchar('phase', { length: 64 }).notNull(),
  },
  (table) => [
    uniqueIndex('group_edition_phase_name_unique').on(table.editionId, table.phase, table.name),
    unique('group_id_edition_unique').on(table.id, table.editionId),
    unique('group_id_edition_phase_unique').on(table.id, table.editionId, table.phase),
  ],
);

export const groupPlayers = pgTable(
  'group_player',
  {
    groupId: uuid('group_id').notNull(),
    editionId: uuid('edition_id').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    isSeed: boolean('is_seed').notNull().default(false),
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

export const matches = pgTable(
  'match',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    groupId: uuid('group_id').notNull(),
    phase: varchar('phase', { length: 64 }).notNull(),
    playerOneId: uuid('player_one_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    playerTwoId: uuid('player_two_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: matchStatusEnum('status').$type<MatchStatus>().notNull().default('AGENDADA'),
    bestOf: integer('best_of').notNull(),
    createdAt,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
    check('match_best_of_valid', sql`${table.bestOf} in (3, 5)`),
    check('match_players_ordered', sql`${table.playerOneId} < ${table.playerTwoId}`),
  ],
);

export const matchParticipants = pgTable(
  'match_participant',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    setsWon: integer('sets_won').notNull().default(0),
  },
  (table) => [
    primaryKey({ name: 'match_participant_pk', columns: [table.matchId, table.playerId] }),
    check('match_participant_sets_won_non_negative', sql`${table.setsWon} >= 0`),
  ],
);

export const standings = pgTable(
  'standing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: uuid('player_id')
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

export const finalPlacements = pgTable(
  'final_placement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: uuid('player_id')
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

export const seasonPlayerPoints = pgTable(
  'season_player_points',
  {
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    accumulatedPoints: integer('accumulated_points').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'season_player_points_pk',
      columns: [table.seasonId, table.playerId],
    }),
    check('season_player_points_non_negative', sql`${table.accumulatedPoints} >= 0`),
  ],
);

export const organizerMagicTokens = pgTable(
  'organizer_magic_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 254 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    uniqueIndex('organizer_magic_token_hash_unique').on(table.tokenHash),
    index('organizer_magic_token_email_idx').on(table.email),
  ],
);

export const organizerSessions = pgTable(
  'organizer_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 254 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex('organizer_session_token_hash_unique').on(table.tokenHash),
    index('organizer_session_email_idx').on(table.email),
  ],
);

export const auditEvents = pgTable(
  'audit_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id').references(() => editions.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    seasonId: uuid('season_id').references(() => seasons.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    matchId: uuid('match_id').references(() => matches.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    payload: jsonb('payload').$type<unknown>().notNull().default({}),
    createdAt,
    createdBy: varchar('created_by', { length: 120 }).notNull(),
  },
  (table) => [
    index('audit_event_edition_created_at_idx').on(table.editionId, table.createdAt),
    index('audit_event_season_created_at_idx').on(table.seasonId, table.createdAt),
    check('audit_event_payload_is_object', sql`jsonb_typeof(${table.payload}) = 'object'`),
    check(
      'audit_event_scope_required',
      sql`${table.editionId} IS NOT NULL OR ${table.seasonId} IS NOT NULL`,
    ),
  ],
);

export const playerRelations = relations(players, ({ many }) => ({
  registrations: many(editionRegistrations),
  groupPlayers: many(groupPlayers),
  matchParticipants: many(matchParticipants),
  finalPlacements: many(finalPlacements),
}));

export const seasonRelations = relations(seasons, ({ many }) => ({
  editions: many(editions),
  playerPoints: many(seasonPlayerPoints),
}));

export const seasonPlayerPointsRelations = relations(seasonPlayerPoints, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonPlayerPoints.seasonId],
    references: [seasons.id],
  }),
  player: one(players, {
    fields: [seasonPlayerPoints.playerId],
    references: [players.id],
  }),
}));

export const editionRelations = relations(editions, ({ one, many }) => ({
  season: one(seasons, {
    fields: [editions.seasonId],
    references: [seasons.id],
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
