import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  CreateEditionBodySchema,
  DEFAULT_TOURNAMENT_RULES,
  EditionRegistrationsResponseSchema,
  EditionSchema,
  ErrorResponseSchema,
  ImportScoresResponseSchema,
  RegisterPlayerBodySchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { parseImportScoresCsv } from '../lib/csv.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { validateTournamentRules } from '../lib/errors.js';
import { mapEdition, mapRegistration } from '../lib/mappers.js';

export async function registerEditionRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/editions',
    {
      preHandler: app.requireOrganizer,
      schema: {
        body: CreateEditionBodySchema,
        response: {
          201: EditionSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const rules = request.body.rules ?? DEFAULT_TOURNAMENT_RULES;
      const rulesError = validateTournamentRules(rules);
      if (rulesError) {
        throw badRequest(`Regras de torneio inválidas: ${rulesError}`);
      }

      const [season] = await app.db
        .select({ id: schema.seasons.id })
        .from(schema.seasons)
        .where(eq(schema.seasons.id, request.body.seasonId))
        .limit(1);

      if (!season) {
        throw notFound('Temporada não encontrada.');
      }

      try {
        const [edition] = await app.db
          .insert(schema.editions)
          .values({
            seasonId: request.body.seasonId,
            name: request.body.name.trim(),
            date: request.body.date,
            rules,
            autoConfirmMinutes: request.body.autoConfirmMinutes ?? 15,
          })
          .returning();

        if (!edition) {
          throw badRequest('Não foi possível criar a edição.');
        }

        await app.db.insert(schema.auditEvents).values({
          editionId: edition.id,
          eventType: 'EDITION_CREATED',
          payload: {
            name: edition.name,
            date: edition.date,
            seasonId: edition.seasonId,
          },
          createdBy: request.organizerEmail ?? 'organizer',
        });

        reply.code(201);
        return mapEdition(edition);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Já existe uma edição com este nome nesta temporada.');
        }

        throw error;
      }
    },
  );

  typed.get(
    '/editions/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: EditionSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const [edition] = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.id, request.params.id))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      return mapEdition(edition);
    },
  );

  typed.get(
    '/editions/:id/registrations',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: EditionRegistrationsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const [edition] = await app.db
        .select({ id: schema.editions.id })
        .from(schema.editions)
        .where(eq(schema.editions.id, request.params.id))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      const registrations = await app.db
        .select()
        .from(schema.editionRegistrations)
        .where(eq(schema.editionRegistrations.editionId, request.params.id))
        .orderBy(schema.editionRegistrations.registeredAt);

      return { registrations: registrations.map(mapRegistration) };
    },
  );

  typed.post(
    '/editions/:id/registrations',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: RegisterPlayerBodySchema,
        response: {
          201: EditionRegistrationsResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const [edition] = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.id, request.params.id))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      if (edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS') {
        throw conflict('Inscrições não estão abertas para esta edição.');
      }

      const [player] = await app.db
        .select({ id: schema.players.id })
        .from(schema.players)
        .where(eq(schema.players.id, request.body.playerId))
        .limit(1);

      if (!player) {
        throw notFound('Jogador não encontrado.');
      }

      try {
        await app.db.insert(schema.editionRegistrations).values({
          editionId: request.params.id,
          playerId: request.body.playerId,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Jogador já inscrito nesta edição.');
        }

        throw error;
      }

      const registrations = await app.db
        .select()
        .from(schema.editionRegistrations)
        .where(eq(schema.editionRegistrations.editionId, request.params.id))
        .orderBy(schema.editionRegistrations.registeredAt);

      reply.code(201);
      return { registrations: registrations.map(mapRegistration) };
    },
  );

  typed.post(
    '/seasons/:id/import-scores',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: ImportScoresResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const seasonId = request.params.id;
      const [season] = await app.db
        .select({ id: schema.seasons.id })
        .from(schema.seasons)
        .where(eq(schema.seasons.id, seasonId))
        .limit(1);

      if (!season) {
        throw notFound('Temporada não encontrada.');
      }

      const csvContent = typeof request.body === 'string' ? request.body : '';
      if (!csvContent.trim()) {
        throw badRequest('Envie o conteúdo CSV no corpo da requisição com Content-Type text/csv.');
      }

      const parsedRows = parseImportScoresCsv(csvContent);
      const importedScores: Array<{ playerName: string; accumulatedPoints: number }> = [];

      await app.db.transaction(async (tx) => {
        for (const row of parsedRows) {
          const [player] = await tx
            .select({ id: schema.players.id, name: schema.players.name })
            .from(schema.players)
            .where(sql`lower(trim(${schema.players.name})) = lower(${row.playerName})`)
            .limit(1);

          if (!player) {
            throw badRequest(
              `Linha ${row.lineNumber}: jogador "${row.playerName}" não encontrado.`,
            );
          }

          await tx
            .insert(schema.seasonPlayerPoints)
            .values({
              seasonId,
              playerId: player.id,
              accumulatedPoints: row.accumulatedPoints,
            })
            .onConflictDoUpdate({
              target: [schema.seasonPlayerPoints.seasonId, schema.seasonPlayerPoints.playerId],
              set: {
                accumulatedPoints: row.accumulatedPoints,
                updatedAt: new Date(),
              },
            });

          importedScores.push({
            playerName: player.name,
            accumulatedPoints: row.accumulatedPoints,
          });
        }

        await tx.insert(schema.auditEvents).values({
          seasonId,
          eventType: 'CSV_IMPORTED',
          payload: {
            importedCount: importedScores.length,
            scores: importedScores,
          },
          createdBy: request.organizerEmail ?? 'organizer',
        });
      });

      return {
        seasonId,
        importedCount: importedScores.length,
        scores: importedScores,
      };
    },
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
