import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ErrorResponseSchema,
  FinalizeEditionResponseSchema,
  PublishPlacementResponseSchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import {
  PLACEMENT_PHASE,
  buildPlacementMatchesForGroup,
  finalizeEditionPlacements,
} from '../lib/matches.js';
import { mapEdition, mapFinalPlacement, mapGroupWithPlayers } from '../lib/mappers.js';
import { emitPhasePublished } from '../lib/sse-events.js';

const editionIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export async function registerEditionPlacementRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/editions/:id/placement/publish',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: editionIdParams,
        response: {
          200: PublishPlacementResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const [edition] = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.id, editionId))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      if (edition.status !== 'FASE_COLOCACAO') {
        throw conflict('A fase de colocação ainda não está pronta para publicação.');
      }

      const placementGroups = await app.db
        .select()
        .from(schema.groups)
        .where(
          and(eq(schema.groups.editionId, editionId), eq(schema.groups.phase, PLACEMENT_PHASE)),
        )
        .orderBy(asc(schema.groups.name));

      if (placementGroups.length === 0) {
        throw conflict('Não há grupos de colocação para publicar. Encerre a edição diretamente.');
      }

      const [existingPlacementMatch] = await app.db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(
          and(eq(schema.matches.editionId, editionId), eq(schema.matches.phase, PLACEMENT_PHASE)),
        )
        .limit(1);

      if (existingPlacementMatch) {
        throw conflict('As partidas da fase de colocação já foram publicadas.');
      }

      const allGroupPlayers = await app.db
        .select()
        .from(schema.groupPlayers)
        .where(eq(schema.groupPlayers.editionId, editionId));

      const playersByGroupId = new Map<string, string[]>();
      for (const groupPlayer of allGroupPlayers) {
        const group = placementGroups.find((entry) => entry.id === groupPlayer.groupId);
        if (!group) {
          continue;
        }

        const current = playersByGroupId.get(groupPlayer.groupId) ?? [];
        current.push(groupPlayer.playerId);
        playersByGroupId.set(groupPlayer.groupId, current);
      }

      const organizer = request.organizerEmail ?? 'organizer';

      let matchesGenerated = 0;

      const [updatedEdition] = await app.db.transaction(async (tx) => {
        for (const group of placementGroups) {
          const playerIds = playersByGroupId.get(group.id) ?? [];
          if (playerIds.length < 2) {
            continue;
          }

          const generatedMatches = buildPlacementMatchesForGroup(playerIds);
          if (generatedMatches.length === 0) {
            continue;
          }

          const insertedMatches = await tx
            .insert(schema.matches)
            .values(
              generatedMatches.map((match) => ({
                editionId,
                groupId: group.id,
                phase: PLACEMENT_PHASE,
                playerOneId: match.playerOneId,
                playerTwoId: match.playerTwoId,
                status: 'AGENDADA' as const,
              })),
            )
            .returning({
              id: schema.matches.id,
              playerOneId: schema.matches.playerOneId,
              playerTwoId: schema.matches.playerTwoId,
            });

          await tx.insert(schema.matchParticipants).values(
            insertedMatches.flatMap((match) => [
              { matchId: match.id, playerId: match.playerOneId, setsWon: 0 },
              { matchId: match.id, playerId: match.playerTwoId, setsWon: 0 },
            ]),
          );

          matchesGenerated += insertedMatches.length;
        }

        const updated = await tx
          .update(schema.editions)
          .set({ status: 'EM_ANDAMENTO' })
          .where(eq(schema.editions.id, editionId))
          .returning();

        await tx.insert(schema.auditEvents).values({
          editionId,
          eventType: 'PLACEMENT_STAGE_PUBLISHED',
          payload: {
            matchesGenerated,
            groupCount: placementGroups.length,
          },
          createdBy: organizer,
        });

        return updated;
      });

      if (!updatedEdition) {
        throw badRequest('Não foi possível publicar a fase de colocação.');
      }

      emitPhasePublished(app, editionId, { matchesGenerated });

      const groups = await app.db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.editionId, editionId))
        .orderBy(asc(schema.groups.name));

      const groupPlayersRows = await app.db
        .select()
        .from(schema.groupPlayers)
        .where(eq(schema.groupPlayers.editionId, editionId));

      return {
        edition: mapEdition(updatedEdition),
        groups: groups.map((group) =>
          mapGroupWithPlayers(
            group,
            groupPlayersRows.filter((player) => player.groupId === group.id),
          ),
        ),
        matchesGenerated,
      };
    },
  );

  typed.post(
    '/editions/:id/finalize',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: editionIdParams,
        response: {
          200: FinalizeEditionResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const editionId = request.params.id;
      const [edition] = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.id, editionId))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      if (edition.status === 'ENCERRADA') {
        throw conflict('Esta edição já foi encerrada.');
      }

      const [championship] = await app.db
        .select()
        .from(schema.championships)
        .where(eq(schema.championships.id, edition.championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      const organizer = request.organizerEmail ?? 'organizer';

      const result = await app.db.transaction(async (tx) => {
        const finalized = await finalizeEditionPlacements(
          tx,
          editionId,
          edition.championshipId,
          championship.scoringTable,
          edition.rules,
        );

        if (!finalized.edition) {
          throw badRequest('Não foi possível encerrar a edição.');
        }

        await tx.insert(schema.auditEvents).values({
          editionId,
          eventType: 'EDITION_FINALIZED',
          payload: {
            placementCount: finalized.placements.length,
          },
          createdBy: organizer,
        });

        return finalized;
      });

      const persistedPlacements = await app.db
        .select()
        .from(schema.finalPlacements)
        .where(eq(schema.finalPlacements.editionId, editionId))
        .orderBy(asc(schema.finalPlacements.position));

      return {
        edition: mapEdition(result.edition!),
        placements: persistedPlacements.map(mapFinalPlacement),
      };
    },
  );
}
