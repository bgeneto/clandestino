import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  DrawSnapshotListResponseSchema,
  EditionContestedMatchesResponseSchema,
  EditionFinalPlacementsResponseSchema,
  EditionMatchesResponseSchema,
  EditionParticipantsResponseSchema,
  EditionStandingsResponseSchema,
  ErrorResponseSchema,
  PlayerMatchesResponseSchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import { getResultSubmitter } from '../lib/matches.js';
import { mapDrawSnapshot, mapFinalPlacement, mapMatch, mapStanding } from '../lib/mappers.js';

const editionIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

async function loadEditionOrThrow(app: FastifyInstance, editionId: string) {
  const [edition] = await app.db
    .select({ id: schema.editions.id, seasonId: schema.editions.seasonId })
    .from(schema.editions)
    .where(eq(schema.editions.id, editionId))
    .limit(1);

  if (!edition) {
    throw notFound('Edição não encontrada.');
  }

  return edition;
}

async function mapMatchesWithSubmitters(
  app: FastifyInstance,
  rows: Array<{
    match: typeof schema.matches.$inferSelect;
    participants: (typeof schema.matchParticipants.$inferSelect)[];
  }>,
) {
  return Promise.all(
    rows.map(async ({ match, participants }) => {
      const resultSubmittedByPlayerId =
        match.status === 'AGUARDANDO_CONFIRMACAO'
          ? ((await getResultSubmitter(app.db, match.id)) ?? undefined)
          : undefined;

      return mapMatch(match, participants, { resultSubmittedByPlayerId });
    }),
  );
}

async function loadMatchRows(app: FastifyInstance, editionId: string, playerId?: string) {
  const matchRows = await app.db
    .select()
    .from(schema.matches)
    .where(
      playerId
        ? and(
            eq(schema.matches.editionId, editionId),
            or(eq(schema.matches.playerOneId, playerId), eq(schema.matches.playerTwoId, playerId)),
          )
        : eq(schema.matches.editionId, editionId),
    )
    .orderBy(asc(schema.matches.createdAt));

  if (matchRows.length === 0) {
    return [];
  }

  const matchIds = matchRows.map((match) => match.id);
  const allParticipants = await app.db
    .select()
    .from(schema.matchParticipants)
    .where(inArray(schema.matchParticipants.matchId, matchIds));

  const participantsByMatchId = new Map<string, typeof allParticipants>();
  for (const participant of allParticipants) {
    const current = participantsByMatchId.get(participant.matchId) ?? [];
    current.push(participant);
    participantsByMatchId.set(participant.matchId, current);
  }

  return matchRows.map((match) => ({
    match,
    participants: participantsByMatchId.get(match.id) ?? [],
  }));
}

export async function registerEditionReadRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/editions/:id/standings',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionStandingsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      await loadEditionOrThrow(app, editionId);

      const groups = await app.db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.editionId, editionId))
        .orderBy(asc(schema.groups.name));

      const groupStandings = await Promise.all(
        groups.map(async (group) => {
          const standings = await app.db
            .select()
            .from(schema.standings)
            .where(eq(schema.standings.groupId, group.id))
            .orderBy(asc(schema.standings.rankInGroup));

          return {
            groupId: group.id,
            standings: standings.map(mapStanding),
          };
        }),
      );

      return { groups: groupStandings.filter((entry) => entry.standings.length > 0) };
    },
  );

  typed.get(
    '/editions/:id/matches',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionMatchesResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      await loadEditionOrThrow(app, editionId);

      const rows = await loadMatchRows(app, editionId);
      const matches = await mapMatchesWithSubmitters(app, rows);

      return { matches };
    },
  );

  typed.get(
    '/editions/:id/me/matches',
    {
      preHandler: app.requirePlayer,
      schema: {
        params: editionIdParams,
        response: {
          200: PlayerMatchesResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const playerId = request.playerId!;

      if (request.playerEditionId !== editionId) {
        throw notFound('Sessão não pertence a esta edição.');
      }

      await loadEditionOrThrow(app, editionId);

      const rows = await loadMatchRows(app, editionId, playerId);
      const matches = await mapMatchesWithSubmitters(app, rows);

      return { matches };
    },
  );

  typed.get(
    '/editions/:id/participants',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionParticipantsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const edition = await loadEditionOrThrow(app, editionId);

      const snapshots = await app.db
        .select()
        .from(schema.drawSnapshots)
        .where(eq(schema.drawSnapshots.editionId, editionId))
        .orderBy(asc(schema.drawSnapshots.rankPosition));

      if (snapshots.length > 0) {
        const playerIds = snapshots.map((snapshot) => snapshot.playerId);
        const players = await app.db
          .select()
          .from(schema.players)
          .where(inArray(schema.players.id, playerIds));

        const namesById = new Map(players.map((player) => [player.id, player.name]));

        return {
          participants: snapshots.map((snapshot) => ({
            playerId: snapshot.playerId,
            playerName: namesById.get(snapshot.playerId) ?? 'Jogador',
            rankPosition: snapshot.rankPosition,
            accumulatedPoints: snapshot.accumulatedPoints,
            isSeed: snapshot.isSeed,
          })),
        };
      }

      const registrations = await app.db
        .select({
          playerId: schema.editionRegistrations.playerId,
          playerName: schema.players.name,
        })
        .from(schema.editionRegistrations)
        .innerJoin(schema.players, eq(schema.editionRegistrations.playerId, schema.players.id))
        .where(eq(schema.editionRegistrations.editionId, editionId))
        .orderBy(asc(schema.players.name));

      const seasonPoints = await app.db
        .select({
          playerId: schema.seasonPlayerPoints.playerId,
          accumulatedPoints: schema.seasonPlayerPoints.accumulatedPoints,
        })
        .from(schema.seasonPlayerPoints)
        .where(eq(schema.seasonPlayerPoints.seasonId, edition.seasonId));

      const pointsByPlayerId = new Map(
        seasonPoints.map((entry) => [entry.playerId, entry.accumulatedPoints]),
      );

      const ranked = [...registrations].sort((left, right) => {
        const leftPoints = pointsByPlayerId.get(left.playerId) ?? 0;
        const rightPoints = pointsByPlayerId.get(right.playerId) ?? 0;
        return rightPoints - leftPoints || left.playerName.localeCompare(right.playerName, 'pt-BR');
      });

      return {
        participants: ranked.map((entry, index) => ({
          playerId: entry.playerId,
          playerName: entry.playerName,
          rankPosition: index + 1,
          accumulatedPoints: pointsByPlayerId.get(entry.playerId) ?? 0,
          isSeed: false,
        })),
      };
    },
  );

  typed.get(
    '/editions/:id/draw-snapshots',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: DrawSnapshotListResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      await loadEditionOrThrow(app, editionId);

      const snapshots = await app.db
        .select()
        .from(schema.drawSnapshots)
        .where(eq(schema.drawSnapshots.editionId, editionId))
        .orderBy(asc(schema.drawSnapshots.rankPosition));

      return { snapshots: snapshots.map(mapDrawSnapshot) };
    },
  );

  typed.get(
    '/editions/:id/final-placements',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionFinalPlacementsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      await loadEditionOrThrow(app, editionId);

      const placements = await app.db
        .select()
        .from(schema.finalPlacements)
        .where(eq(schema.finalPlacements.editionId, editionId))
        .orderBy(asc(schema.finalPlacements.position));

      return { placements: placements.map(mapFinalPlacement) };
    },
  );

  typed.get(
    '/editions/:id/contested-matches',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionContestedMatchesResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      await loadEditionOrThrow(app, editionId);

      const contestedRows = await app.db
        .select()
        .from(schema.matches)
        .where(
          and(eq(schema.matches.editionId, editionId), eq(schema.matches.status, 'CONTESTADA')),
        )
        .orderBy(asc(schema.matches.updatedAt));

      if (contestedRows.length === 0) {
        return { contests: [] };
      }

      const matchIds = contestedRows.map((match) => match.id);
      const allParticipants = await app.db
        .select()
        .from(schema.matchParticipants)
        .where(inArray(schema.matchParticipants.matchId, matchIds));

      const participantsByMatchId = new Map<string, typeof allParticipants>();
      for (const participant of allParticipants) {
        const current = participantsByMatchId.get(participant.matchId) ?? [];
        current.push(participant);
        participantsByMatchId.set(participant.matchId, current);
      }

      const contests = await Promise.all(
        contestedRows.map(async (match) => {
          const [auditEvent] = await app.db
            .select({ payload: schema.auditEvents.payload })
            .from(schema.auditEvents)
            .where(
              and(
                eq(schema.auditEvents.matchId, match.id),
                eq(schema.auditEvents.eventType, 'MATCH_CONTESTED'),
              ),
            )
            .orderBy(desc(schema.auditEvents.createdAt))
            .limit(1);

          const payload = auditEvent?.payload;
          const contestReason =
            typeof payload === 'object' &&
            payload !== null &&
            'reason' in payload &&
            (typeof payload.reason === 'string' || payload.reason === null)
              ? payload.reason
              : undefined;

          return {
            match: mapMatch(match, participantsByMatchId.get(match.id) ?? []),
            ...(contestReason !== undefined ? { contestReason } : {}),
          };
        }),
      );

      return { contests };
    },
  );
}
