import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  EditionGroupsResponseSchema,
  EditionQrResponseSchema,
  EditionSchema,
  ErrorResponseSchema,
  ExecuteDrawBodySchema,
  GenerateMatchesResponseSchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { generateSecureToken } from '../lib/crypto.js';
import {
  DRAW_ALGORITHM,
  GROUP_PHASE,
  buildGeneratedGroupMatches,
  executeDrawAlgorithm,
  rankEditionPlayers,
  resolveMatchBestOf,
} from '../lib/draw.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import {
  mapEdition,
  mapGroupPlayer,
  mapGroupWithPlayers,
} from '../lib/mappers.js';

const editionIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export async function registerEditionDrawRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/editions/:id/draw',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: editionIdParams,
        body: ExecuteDrawBodySchema,
        response: {
          201: EditionGroupsResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const editionId = request.params.id;
      const edition = await loadEdition(app, editionId);
      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      if (edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS') {
        throw conflict('O sorteio só pode ser executado antes da publicação das partidas.');
      }

      const existingDraw = await app.db
        .select({ id: schema.drawSnapshots.id })
        .from(schema.drawSnapshots)
        .where(eq(schema.drawSnapshots.editionId, editionId))
        .limit(1);

      if (existingDraw.length > 0) {
        throw conflict('Esta edição já possui um sorteio publicado.');
      }

      const registrations = await app.db
        .select({
          playerId: schema.editionRegistrations.playerId,
          playerName: schema.players.name,
        })
        .from(schema.editionRegistrations)
        .innerJoin(schema.players, eq(schema.editionRegistrations.playerId, schema.players.id))
        .where(eq(schema.editionRegistrations.editionId, editionId));

      if (registrations.length < edition.rules.minimumGroupSize) {
        throw badRequest(
          `São necessários ao menos ${edition.rules.minimumGroupSize} jogadores inscritos para o sorteio.`,
        );
      }

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
      const rankedPlayers = rankEditionPlayers(
        registrations,
        pointsByPlayerId,
        edition.rules.protectedSeedCount,
      );
      const randomSeed = request.body.randomSeed?.trim() || generateSecureToken(16);
      const drawnBy = request.organizerEmail ?? 'organizer';
      const drawnAt = new Date();

      let drawResult;
      try {
        drawResult = executeDrawAlgorithm({
          rankedPlayers,
          rules: edition.rules,
          randomSeed,
        });
      } catch (error) {
        throw badRequest(
          error instanceof Error ? error.message : 'Não foi possível executar o sorteio.',
        );
      }

      await app.db.transaction(async (tx) => {
        await tx.insert(schema.drawSnapshots).values(
          rankedPlayers.map((player) => ({
            editionId,
            playerId: player.playerId,
            accumulatedPoints: player.accumulatedPoints,
            rankPosition: player.rankPosition,
            isSeed: player.isSeed,
            algorithm: DRAW_ALGORITHM,
            randomSeed,
            drawnAt,
            drawnBy,
          })),
        );

        const insertedGroups = await tx
          .insert(schema.groups)
          .values(
            drawResult.groups.map((group) => ({
              editionId,
              name: group.name,
              phase: GROUP_PHASE,
            })),
          )
          .returning();

        const groupPlayers = drawResult.groups.flatMap((group, index) => {
          const groupId = insertedGroups[index]?.id;
          if (!groupId) {
            throw badRequest('Falha ao persistir os grupos do sorteio.');
          }

          return group.players.map((player) => ({
            groupId,
            editionId,
            playerId: player.playerId,
            isSeed: player.isSeed,
          }));
        });

        await tx.insert(schema.groupPlayers).values(groupPlayers);

        await tx
          .update(schema.editions)
          .set({ status: 'SORTEIO_PUBLICADO' })
          .where(eq(schema.editions.id, editionId));

        await tx.insert(schema.auditEvents).values({
          editionId,
          eventType: 'DRAW_EXECUTED',
          payload: {
            algorithm: DRAW_ALGORITHM,
            randomSeed,
            groupCount: drawResult.groupCount,
            playerCount: rankedPlayers.length,
          },
          createdBy: drawnBy,
        });
      });

      reply.code(201);
      return loadEditionGroups(app, editionId);
    },
  );

  typed.delete(
    '/editions/:id/draw',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: editionIdParams,
        response: {
          200: EditionSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const edition = await loadEdition(app, editionId);
      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      const [existingDraw] = await app.db
        .select({ id: schema.drawSnapshots.id })
        .from(schema.drawSnapshots)
        .where(eq(schema.drawSnapshots.editionId, editionId))
        .limit(1);

      if (!existingDraw) {
        throw notFound('Não há sorteio publicado para esta edição.');
      }

      const [existingMatch] = await app.db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(eq(schema.matches.editionId, editionId))
        .limit(1);

      if (existingMatch) {
        throw conflict('Não é possível cancelar o sorteio após a geração das partidas.');
      }

      const cancelledBy = request.organizerEmail ?? 'organizer';

      const [updatedEdition] = await app.db.transaction(async (tx) => {
        await tx.delete(schema.drawSnapshots).where(eq(schema.drawSnapshots.editionId, editionId));
        await tx.delete(schema.groupPlayers).where(eq(schema.groupPlayers.editionId, editionId));
        await tx.delete(schema.groups).where(eq(schema.groups.editionId, editionId));

        const nextStatus =
          edition.status === 'SORTEIO_PUBLICADO' ? 'INSCRICOES_ABERTAS' : edition.status;

        const updated = await tx
          .update(schema.editions)
          .set({ status: nextStatus })
          .where(eq(schema.editions.id, editionId))
          .returning();

        await tx.insert(schema.auditEvents).values({
          editionId,
          eventType: 'DRAW_CANCELLED',
          payload: {},
          createdBy: cancelledBy,
        });

        return updated;
      });

      if (!updatedEdition) {
        throw badRequest('Não foi possível cancelar o sorteio.');
      }

      return mapEdition(updatedEdition);
    },
  );

  typed.get(
    '/editions/:id/groups',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionGroupsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const edition = await loadEdition(app, editionId);
      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      return loadEditionGroups(app, editionId);
    },
  );

  typed.post(
    '/editions/:id/matches/generate',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: editionIdParams,
        response: {
          200: GenerateMatchesResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const edition = await loadEdition(app, editionId);
      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      if (edition.status !== 'SORTEIO_PUBLICADO') {
        throw conflict('As partidas só podem ser geradas após o sorteio ser publicado.');
      }

      const [existingMatch] = await app.db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(eq(schema.matches.editionId, editionId))
        .limit(1);

      if (existingMatch) {
        throw conflict('As partidas desta edição já foram geradas.');
      }

      const groups = await app.db
        .select()
        .from(schema.groups)
        .where(and(eq(schema.groups.editionId, editionId), eq(schema.groups.phase, GROUP_PHASE)))
        .orderBy(asc(schema.groups.name));

      if (groups.length === 0) {
        throw conflict('Não há grupos publicados para gerar as partidas.');
      }

      const groupPlayers = await app.db
        .select()
        .from(schema.groupPlayers)
        .where(eq(schema.groupPlayers.editionId, editionId));

      const playersByGroupId = new Map<string, typeof groupPlayers>();
      for (const groupPlayer of groupPlayers) {
        const current = playersByGroupId.get(groupPlayer.groupId) ?? [];
        current.push(groupPlayer);
        playersByGroupId.set(groupPlayer.groupId, current);
      }

      const drawGroups = groups.map((group, index) => ({
        index,
        name: group.name,
        players: (playersByGroupId.get(group.id) ?? []).map((player) => ({
          playerId: player.playerId,
          isSeed: player.isSeed,
        })),
      }));

      const registrationCount = await app.db
        .select({ playerId: schema.editionRegistrations.playerId })
        .from(schema.editionRegistrations)
        .where(eq(schema.editionRegistrations.editionId, editionId));

      const bestOf = resolveMatchBestOf(registrationCount.length, edition.rules);
      const generatedMatches = buildGeneratedGroupMatches(drawGroups);

      const [updatedEdition] = await app.db.transaction(async (tx) => {
        const insertedMatches = await tx
          .insert(schema.matches)
          .values(
            generatedMatches.map((match) => ({
              editionId,
              groupId: groups[match.groupIndex]!.id,
              phase: GROUP_PHASE,
              playerOneId: match.playerOneId,
              playerTwoId: match.playerTwoId,
              bestOf,
              status: 'AGENDADA' as const,
            })),
          )
          .returning({ id: schema.matches.id, playerOneId: schema.matches.playerOneId, playerTwoId: schema.matches.playerTwoId });

        await tx.insert(schema.matchParticipants).values(
          insertedMatches.flatMap((match) => [
            { matchId: match.id, playerId: match.playerOneId, setsWon: 0 },
            { matchId: match.id, playerId: match.playerTwoId, setsWon: 0 },
          ]),
        );

        const updated = await tx
          .update(schema.editions)
          .set({ status: 'EM_ANDAMENTO' })
          .where(eq(schema.editions.id, editionId))
          .returning();

        return updated;
      });

      if (!updatedEdition) {
        throw badRequest('Não foi possível gerar as partidas.');
      }

      return {
        edition: mapEdition(updatedEdition),
        matchesGenerated: generatedMatches.length,
      };
    },
  );

  typed.get(
    '/editions/:id/qr',
    {
      schema: {
        params: editionIdParams,
        response: {
          200: EditionQrResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const edition = await loadEdition(app, editionId);
      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      return {
        editionId,
        url: `${app.config.publicAppUrl}/edicao/${editionId}/entrar`,
        editionName: edition.name,
        editionDate: edition.date,
      };
    },
  );
}

async function loadEdition(app: FastifyInstance, editionId: string) {
  const [edition] = await app.db
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, editionId))
    .limit(1);

  return edition ?? null;
}

async function loadEditionGroups(app: FastifyInstance, editionId: string) {
  const groups = await app.db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.editionId, editionId))
    .orderBy(asc(schema.groups.name));

  const groupPlayers = await app.db
    .select()
    .from(schema.groupPlayers)
    .where(eq(schema.groupPlayers.editionId, editionId));

  const playersByGroupId = new Map<string, ReturnType<typeof mapGroupPlayer>[]>();
  for (const groupPlayer of groupPlayers) {
    const current = playersByGroupId.get(groupPlayer.groupId) ?? [];
    current.push(mapGroupPlayer(groupPlayer));
    playersByGroupId.set(groupPlayer.groupId, current);
  }

  return {
    groups: groups.map((group) =>
      mapGroupWithPlayers(
        group,
        groupPlayers.filter((player) => player.groupId === group.id),
      ),
    ),
  };
}
