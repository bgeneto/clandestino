import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  CreateEditionBodySchema,
  DEFAULT_EDITION_RULES,
  EditionRegistrationsResponseSchema,
  EditionSchema,
  ErrorResponseSchema,
  RegisterPlayerBodySchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { ensureChampionshipPlayer } from '../lib/championship-roster.js';
import { nextEditionNameForChampionship } from '../lib/editions.js';
import {
  badRequest,
  conflict,
  isUniqueViolation,
  notFound,
  validateEditionRules,
} from '../lib/errors.js';
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
      const [championship] = await app.db
        .select()
        .from(schema.championships)
        .where(eq(schema.championships.id, request.body.championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      const rules = request.body.rules ?? championship.defaultEditionRules ?? DEFAULT_EDITION_RULES;
      const rulesError = validateEditionRules(rules);
      if (rulesError) {
        throw badRequest(`Regras da edição inválidas: ${rulesError}`);
      }

      const name = await nextEditionNameForChampionship(app.db, request.body.championshipId);

      try {
        const [edition] = await app.db
          .insert(schema.editions)
          .values({
            championshipId: request.body.championshipId,
            name,
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
            championshipId: edition.championshipId,
          },
          createdBy: request.organizerEmail ?? 'organizer',
        });

        reply.code(201);
        return mapEdition(edition);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Já existe uma edição com este nome neste campeonato.');
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

      await ensureChampionshipPlayer(app.db, edition.championshipId, request.body.playerId);

      const registrations = await app.db
        .select()
        .from(schema.editionRegistrations)
        .where(eq(schema.editionRegistrations.editionId, request.params.id))
        .orderBy(schema.editionRegistrations.registeredAt);

      reply.code(201);
      return { registrations: registrations.map(mapRegistration) };
    },
  );
}
