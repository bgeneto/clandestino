import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ContestMatchBodySchema,
  CorrectMatchResultBodySchema,
  ErrorResponseSchema,
  MatchResultResponseSchema,
  SubmitMatchResultBodySchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unprocessableEntity,
} from '../lib/errors.js';
import {
  getResultSubmitter,
  loadMatch,
  mapSetsToParticipants,
  maybeGeneratePlacementStage,
  recalculateGroupStanding,
  validateCorrectedScore,
  validateSubmittedScore,
} from '../lib/matches.js';
import { mapMatch } from '../lib/mappers.js';
import { GROUP_PHASE } from '../lib/draw.js';

const matchIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

async function loadEditionRules(app: FastifyInstance, editionId: string) {
  const [edition] = await app.db
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, editionId))
    .limit(1);

  if (!edition) {
    throw notFound('Edição não encontrada.');
  }

  return edition;
}

async function confirmMatchResult(
  app: FastifyInstance,
  matchId: string,
  createdBy: string,
  auditEventType: 'MATCH_CONFIRMED' | 'MATCH_CORRECTED',
): Promise<ReturnType<typeof mapMatch>> {
  const loaded = await loadMatch(app.db, matchId);
  if (!loaded) {
    throw notFound('Partida não encontrada.');
  }

  const { match, participants } = loaded;
  const edition = await loadEditionRules(app, match.editionId);
  const now = new Date();

  await app.db.transaction(async (tx) => {
    await tx
      .update(schema.matches)
      .set({ status: 'CONFIRMADA', updatedAt: now })
      .where(eq(schema.matches.id, match.id));

    await recalculateGroupStanding(tx, match.groupId, edition.rules);

    if (match.phase === GROUP_PHASE) {
      await maybeGeneratePlacementStage(
        tx,
        match.editionId,
        edition.rules,
        createdBy,
      );
    }

    await tx.insert(schema.auditEvents).values({
      editionId: match.editionId,
      matchId: match.id,
      eventType: auditEventType,
      payload: {
        groupId: match.groupId,
        phase: match.phase,
        playerOneId: match.playerOneId,
        playerTwoId: match.playerTwoId,
        setsWon: {
          [match.playerOneId]: participants.find(
            (participant) => participant.playerId === match.playerOneId,
          )?.setsWon,
          [match.playerTwoId]: participants.find(
            (participant) => participant.playerId === match.playerTwoId,
          )?.setsWon,
        },
      },
      createdBy,
    });
  });

  const updated = await loadMatch(app.db, matchId);
  if (!updated) {
    throw badRequest('Não foi possível confirmar o resultado.');
  }

  return mapMatch(updated.match, updated.participants);
}

export async function registerMatchRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/matches/:id/result',
    {
      preHandler: app.requirePlayer,
      schema: {
        params: matchIdParams,
        body: SubmitMatchResultBodySchema,
        response: {
          200: MatchResultResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const loaded = await loadMatch(app.db, request.params.id);
      if (!loaded) {
        throw notFound('Partida não encontrada.');
      }

      const { match } = loaded;
      const playerId = request.playerId!;
      const editionId = request.playerEditionId!;

      if (match.editionId !== editionId) {
        throw forbidden('Esta partida não pertence à edição da sessão.');
      }

      if (match.status !== 'AGENDADA') {
        throw conflict('Esta partida não aceita novos resultados.');
      }

      if (match.playerOneId !== playerId && match.playerTwoId !== playerId) {
        throw forbidden('Apenas participantes podem registrar o resultado.');
      }

      const edition = await loadEditionRules(app, editionId);
      const validation = validateSubmittedScore(
        request.body.setsWonByReporter,
        request.body.setsWonByOpponent,
        match.bestOf as 3 | 5,
        edition.rules,
      );

      if (!validation.valid) {
        throw unprocessableEntity('Placar inválido para o formato da partida.', {
          reason: validation.reason,
        });
      }

      const { playerOneSets, playerTwoSets } = mapSetsToParticipants(
        playerId,
        match.playerOneId,
        match.playerTwoId,
        request.body.setsWonByReporter,
        request.body.setsWonByOpponent,
      );

      const now = new Date();

      await app.db.transaction(async (tx) => {
        await tx
          .update(schema.matchParticipants)
          .set({ setsWon: playerOneSets })
          .where(
            and(
              eq(schema.matchParticipants.matchId, match.id),
              eq(schema.matchParticipants.playerId, match.playerOneId),
            ),
          );

        await tx
          .update(schema.matchParticipants)
          .set({ setsWon: playerTwoSets })
          .where(
            and(
              eq(schema.matchParticipants.matchId, match.id),
              eq(schema.matchParticipants.playerId, match.playerTwoId),
            ),
          );

        await tx
          .update(schema.matches)
          .set({ status: 'AGUARDANDO_CONFIRMACAO', updatedAt: now })
          .where(eq(schema.matches.id, match.id));

        await tx.insert(schema.auditEvents).values({
          editionId: match.editionId,
          matchId: match.id,
          eventType: 'MATCH_RESULT_SUBMITTED',
          payload: {
            submittedByPlayerId: playerId,
            setsWonByReporter: request.body.setsWonByReporter,
            setsWonByOpponent: request.body.setsWonByOpponent,
            playerOneSets,
            playerTwoSets,
          },
          createdBy: playerId,
        });
      });

      const updated = await loadMatch(app.db, match.id);
      if (!updated) {
        throw badRequest('Não foi possível registrar o resultado.');
      }

      return { match: mapMatch(updated.match, updated.participants) };
    },
  );

  typed.post(
    '/matches/:id/confirm',
    {
      preHandler: app.requirePlayer,
      schema: {
        params: matchIdParams,
        response: {
          200: MatchResultResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const loaded = await loadMatch(app.db, request.params.id);
      if (!loaded) {
        throw notFound('Partida não encontrada.');
      }

      const { match } = loaded;
      const playerId = request.playerId!;
      const editionId = request.playerEditionId!;

      if (match.editionId !== editionId) {
        throw forbidden('Esta partida não pertence à edição da sessão.');
      }

      if (match.status !== 'AGUARDANDO_CONFIRMACAO') {
        throw conflict('Esta partida não está aguardando confirmação.');
      }

      if (match.playerOneId !== playerId && match.playerTwoId !== playerId) {
        throw forbidden('Apenas participantes podem confirmar o resultado.');
      }

      const submitterId = await getResultSubmitter(app.db, match.id);
      if (!submitterId) {
        throw conflict('Não foi possível identificar quem registrou o resultado.');
      }

      if (submitterId === playerId) {
        throw forbidden('O jogador que registrou o resultado não pode confirmá-lo.');
      }

      const confirmedMatch = await confirmMatchResult(app, match.id, playerId, 'MATCH_CONFIRMED');
      return { match: confirmedMatch };
    },
  );

  typed.post(
    '/matches/:id/contest',
    {
      preHandler: app.requirePlayer,
      schema: {
        params: matchIdParams,
        body: ContestMatchBodySchema,
        response: {
          200: MatchResultResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const loaded = await loadMatch(app.db, request.params.id);
      if (!loaded) {
        throw notFound('Partida não encontrada.');
      }

      const { match } = loaded;
      const playerId = request.playerId!;
      const editionId = request.playerEditionId!;

      if (match.editionId !== editionId) {
        throw forbidden('Esta partida não pertence à edição da sessão.');
      }

      if (match.status !== 'AGUARDANDO_CONFIRMACAO') {
        throw conflict('Esta partida não está aguardando confirmação.');
      }

      if (match.playerOneId !== playerId && match.playerTwoId !== playerId) {
        throw forbidden('Apenas participantes podem contestar o resultado.');
      }

      const submitterId = await getResultSubmitter(app.db, match.id);
      if (!submitterId) {
        throw conflict('Não foi possível identificar quem registrou o resultado.');
      }

      if (submitterId === playerId) {
        throw forbidden('O jogador que registrou o resultado não pode contestá-lo.');
      }

      const now = new Date();

      await app.db.transaction(async (tx) => {
        await tx
          .update(schema.matches)
          .set({ status: 'CONTESTADA', updatedAt: now })
          .where(eq(schema.matches.id, match.id));

        await tx.insert(schema.auditEvents).values({
          editionId: match.editionId,
          matchId: match.id,
          eventType: 'MATCH_CONTESTED',
          payload: {
            contestedByPlayerId: playerId,
            reason: request.body.reason ?? null,
          },
          createdBy: playerId,
        });
      });

      const updated = await loadMatch(app.db, match.id);
      if (!updated) {
        throw badRequest('Não foi possível contestar o resultado.');
      }

      return { match: mapMatch(updated.match, updated.participants) };
    },
  );

  typed.put(
    '/matches/:id/result',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: matchIdParams,
        body: CorrectMatchResultBodySchema,
        response: {
          200: MatchResultResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const loaded = await loadMatch(app.db, request.params.id);
      if (!loaded) {
        throw notFound('Partida não encontrada.');
      }

      const { match } = loaded;

      if (match.status !== 'CONTESTADA') {
        throw conflict('Apenas partidas contestadas podem ser corrigidas pelo organizador.');
      }

      const edition = await loadEditionRules(app, match.editionId);
      const validation = validateCorrectedScore(
        request.body.setsWonByPlayerOne,
        request.body.setsWonByPlayerTwo,
        match.bestOf as 3 | 5,
        edition.rules,
      );

      if (!validation.valid) {
        throw unprocessableEntity('Placar inválido para o formato da partida.', {
          reason: validation.reason,
        });
      }

      const now = new Date();
      const organizer = request.organizerEmail ?? 'organizer';

      await app.db.transaction(async (tx) => {
        await tx
          .update(schema.matchParticipants)
          .set({ setsWon: request.body.setsWonByPlayerOne })
          .where(
            and(
              eq(schema.matchParticipants.matchId, match.id),
              eq(schema.matchParticipants.playerId, match.playerOneId),
            ),
          );

        await tx
          .update(schema.matchParticipants)
          .set({ setsWon: request.body.setsWonByPlayerTwo })
          .where(
            and(
              eq(schema.matchParticipants.matchId, match.id),
              eq(schema.matchParticipants.playerId, match.playerTwoId),
            ),
          );

        await tx
          .update(schema.matches)
          .set({ status: 'CONFIRMADA', updatedAt: now })
          .where(eq(schema.matches.id, match.id));

        await recalculateGroupStanding(tx, match.groupId, edition.rules);

        if (match.phase === GROUP_PHASE) {
          await maybeGeneratePlacementStage(tx, match.editionId, edition.rules, organizer);
        }

        await tx.insert(schema.auditEvents).values({
          editionId: match.editionId,
          matchId: match.id,
          eventType: 'MATCH_CORRECTED',
          payload: {
            setsWonByPlayerOne: request.body.setsWonByPlayerOne,
            setsWonByPlayerTwo: request.body.setsWonByPlayerTwo,
          },
          createdBy: organizer,
        });
      });

      const updated = await loadMatch(app.db, match.id);
      if (!updated) {
        throw badRequest('Não foi possível corrigir o resultado.');
      }

      return { match: mapMatch(updated.match, updated.participants) };
    },
  );
}
