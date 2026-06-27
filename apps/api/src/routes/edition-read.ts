import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  EditionMatchesResponseSchema,
  EditionParticipantsResponseSchema,
  EditionStandingsResponseSchema,
  ErrorResponseSchema,
  PlayerMatchesResponseSchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import { getResultSubmitter } from '../lib/matches.js';
import { mapMatch, mapStanding } from '../lib/mappers.js';

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
}
