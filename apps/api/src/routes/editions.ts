import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  countSkippedRecurrenceDates,
  CreateEditionBodySchema,
  CreateEditionsResponseSchema,
  DEFAULT_EDITION_RULES,
  DeleteEditionResponseSchema,
  EditionRegistrationsResponseSchema,
  EditionSchema,
  ErrorResponseSchema,
  generateRecurringEditionDates,
  normalizeEditionRules,
  RegisterPlayerBodySchema,
  UpdateEditionBodySchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { ensureChampionshipPlayer } from '../lib/championship-roster.js';
import {
  fetchExistingEditionDates,
  pendingEditionName,
  renumberEditionNamesForChampionship,
} from '../lib/editions.js';
import {
  badRequest,
  conflict,
  isUniqueViolation,
  notFound,
  validateEditionRules,
} from '../lib/errors.js';
import {
  deriveRulesFromDrawPlan,
  mergeDrawPlan,
  validateDrawPlanAgainstRegistrations,
} from '../lib/draw-plan.js';
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
          201: CreateEditionsResponseSchema,
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

      if (championship.archivedAt) {
        throw conflict('Não é possível criar edições em um campeonato arquivado.');
      }

      const rules = normalizeEditionRules(
        request.body.rules ?? championship.defaultEditionRules ?? DEFAULT_EDITION_RULES,
      );
      const rulesError = validateEditionRules(rules);
      if (rulesError) {
        throw badRequest(`Regras da edição inválidas: ${rulesError}`);
      }

      const recurrence = request.body.recurrence ?? 'none';
      let generatedDates: string[];

      try {
        generatedDates = generateRecurringEditionDates(request.body.date, recurrence);
      } catch (error) {
        throw badRequest(
          error instanceof Error ? error.message : 'Recorrência de edições inválida.',
        );
      }

      if (generatedDates.length === 0) {
        throw badRequest(
          recurrence === 'monthly'
            ? 'A data inicial é posterior ao fim do ano selecionado.'
            : 'Não foi possível gerar edições para esta recorrência.',
        );
      }

      const existingDates = await fetchExistingEditionDates(app.db, request.body.championshipId);
      const { datesToCreate, skippedDates } = countSkippedRecurrenceDates(
        generatedDates,
        existingDates,
      );

      if (datesToCreate.length === 0) {
        throw conflict('Todas as datas já possuem edição neste campeonato.');
      }

      const autoConfirmMinutes = request.body.autoConfirmMinutes ?? 15;
      const createdEditionIds: string[] = [];

      try {
        await app.db.transaction(async (tx) => {
          for (const date of datesToCreate) {
            const editionId = crypto.randomUUID();
            createdEditionIds.push(editionId);

            await tx.insert(schema.editions).values({
              id: editionId,
              championshipId: request.body.championshipId,
              name: pendingEditionName(editionId),
              date,
              rules,
              autoConfirmMinutes,
            });
          }

          await renumberEditionNamesForChampionship(tx, request.body.championshipId);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Já existe uma edição com este nome neste campeonato.');
        }

        throw error;
      }

      const createdEditions = await app.db
        .select()
        .from(schema.editions)
        .where(inArray(schema.editions.id, createdEditionIds))
        .orderBy(asc(schema.editions.date), asc(schema.editions.createdAt));

      for (const edition of createdEditions) {
        await app.db.insert(schema.auditEvents).values({
          editionId: edition.id,
          eventType: 'EDITION_CREATED',
          payload: {
            name: edition.name,
            date: edition.date,
            championshipId: edition.championshipId,
            recurrence,
            bulk: createdEditions.length > 1,
          },
          createdBy: request.organizerEmail ?? 'organizer',
        });
      }

      reply.code(201);
      return {
        editions: createdEditions.map(mapEdition),
        skippedDates,
        createdCount: createdEditions.length,
        skippedCount: skippedDates.length,
      };
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

  typed.patch(
    '/editions/:id',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: UpdateEditionBodySchema,
        response: {
          200: EditionSchema,
          400: ErrorResponseSchema,
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

      if (edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS') {
        throw conflict('A edição não pode ser alterada neste status.');
      }

      const [drawSnapshotCountRow, groupCountRow] = await Promise.all([
        app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.drawSnapshots)
          .where(eq(schema.drawSnapshots.editionId, editionId)),
        app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.groups)
          .where(eq(schema.groups.editionId, editionId)),
      ]);

      const hasPublishedDraw =
        (drawSnapshotCountRow[0]?.count ?? 0) > 0 || (groupCountRow[0]?.count ?? 0) > 0;

      if (hasPublishedDraw) {
        throw conflict('Não é possível alterar a configuração após o sorteio publicado.');
      }

      if (request.body.rules === undefined && request.body.drawPlan === undefined) {
        throw badRequest('Nenhum campo para atualizar.');
      }

      let nextRules = normalizeEditionRules(edition.rules);
      if (request.body.rules !== undefined) {
        nextRules = normalizeEditionRules(request.body.rules);
        const rulesError = validateEditionRules(nextRules);
        if (rulesError) {
          throw badRequest(`Regras da edição inválidas: ${rulesError}`);
        }
      }

      const nextDrawPlan = mergeDrawPlan(edition.drawPlan, request.body.drawPlan);
      if (nextDrawPlan?.groupCount !== undefined) {
        nextRules = deriveRulesFromDrawPlan(nextRules, nextDrawPlan);
      }

      if (nextDrawPlan) {
        const registrations = await app.db
          .select({ playerId: schema.editionRegistrations.playerId })
          .from(schema.editionRegistrations)
          .where(eq(schema.editionRegistrations.editionId, editionId));

        const drawPlanError = validateDrawPlanAgainstRegistrations(
          nextDrawPlan,
          registrations.length,
          new Set(registrations.map((entry) => entry.playerId)),
        );

        if (drawPlanError) {
          throw badRequest(drawPlanError);
        }
      }

      const [updatedEdition] = await app.db
        .update(schema.editions)
        .set({
          rules: nextRules,
          drawPlan: nextDrawPlan,
        })
        .where(eq(schema.editions.id, editionId))
        .returning();

      if (!updatedEdition) {
        throw notFound('Edição não encontrada.');
      }

      return mapEdition(updatedEdition);
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

  typed.delete(
    '/editions/:id/registrations/:playerId',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
          playerId: Type.String({ format: 'uuid' }),
        }),
        response: {
          200: EditionRegistrationsResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
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

      if (edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS') {
        throw conflict('Inscrições não estão abertas para esta edição.');
      }

      const deleted = await app.db
        .delete(schema.editionRegistrations)
        .where(
          and(
            eq(schema.editionRegistrations.editionId, request.params.id),
            eq(schema.editionRegistrations.playerId, request.params.playerId),
          ),
        )
        .returning({ playerId: schema.editionRegistrations.playerId });

      if (deleted.length === 0) {
        throw notFound('Jogador não inscrito nesta edição.');
      }

      const registrations = await app.db
        .select()
        .from(schema.editionRegistrations)
        .where(eq(schema.editionRegistrations.editionId, request.params.id))
        .orderBy(schema.editionRegistrations.registeredAt);

      return { registrations: registrations.map(mapRegistration) };
    },
  );

  typed.delete(
    '/editions/:id',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: DeleteEditionResponseSchema,
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

      const [championship] = await app.db
        .select({ archivedAt: schema.championships.archivedAt })
        .from(schema.championships)
        .where(eq(schema.championships.id, edition.championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      if (championship.archivedAt) {
        throw conflict('Não é possível excluir edições de um campeonato arquivado.');
      }

      if (edition.status !== 'RASCUNHO' && edition.status !== 'INSCRICOES_ABERTAS') {
        throw conflict('Não é possível excluir uma edição em andamento ou encerrada.');
      }

      const [registrationCountRow, matchCountRow] = await Promise.all([
        app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.editionRegistrations)
          .where(eq(schema.editionRegistrations.editionId, editionId)),
        app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.matches)
          .where(eq(schema.matches.editionId, editionId)),
      ]);

      const registrationCount = registrationCountRow[0]?.count ?? 0;
      const matchCount = matchCountRow[0]?.count ?? 0;

      if (registrationCount > 0) {
        throw conflict('Não é possível excluir uma edição com jogadores inscritos.');
      }

      if (matchCount > 0) {
        throw conflict('Não é possível excluir uma edição que já possui partidas.');
      }

      const deletedAt = new Date().toISOString();

      await app.db.insert(schema.auditEvents).values({
        championshipId: edition.championshipId,
        eventType: 'EDITION_DELETED',
        payload: {
          editionId: edition.id,
          name: edition.name,
          date: edition.date,
          status: edition.status,
        },
        createdBy: request.organizerEmail ?? 'organizer',
      });

      await app.db.transaction(async (tx) => {
        await tx.delete(schema.editions).where(eq(schema.editions.id, editionId));
        await renumberEditionNamesForChampionship(tx, edition.championshipId);
      });

      return {
        id: editionId,
        championshipId: edition.championshipId,
        deletedAt,
      };
    },
  );
}
