import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ContestMatchBodySchema,
  CorrectMatchResultBodySchema,
  ErrorResponseSchema,
  MatchResultResponseSchema,
  SubmitMatchResultBodySchema,
  normalizeEditionRules,
} from '@clandestino/shared-contracts';
import { resolveMatchBestOf } from '@clandestino/tournament-engine';
import { Type } from '@sinclair/typebox';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import {
  confirmMatchResult,
  countEditionRegistrations,
  getResultSubmitter,
  loadMatch,
  mapSetsToParticipants,
} from '../lib/matches.js';
import { parseOrganizerMatchCorrection, parsePlayerMatchSubmission } from '../lib/match-result.js';
import { mapMatch } from '../lib/mappers.js';
import {
  emitMatchConfirmed,
  emitMatchContested,
  emitMatchResultSubmitted,
} from '../lib/sse-events.js';

const matchIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

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

      const [edition] = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.id, match.editionId))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      const participantCount = await countEditionRegistrations(app.db, match.editionId);
      const bestOf = resolveMatchBestOf(normalizeEditionRules(edition.rules), participantCount);

      const parsed = parsePlayerMatchSubmission(
        request.body,
        playerId,
        match.playerOneId,
        match.playerTwoId,
        bestOf,
      );

      if (parsed.outcome === 'WALKOVER') {
        const confirmed = await confirmMatchResult(app.db, match.id, playerId, 'MATCH_CONFIRMED', {
          expectedStatuses: ['AGENDADA'],
          correctedSets: {
            playerOneSets: parsed.playerOneSets,
            playerTwoSets: parsed.playerTwoSets,
          },
          outcome: 'WALKOVER',
          walkoverAbsentPlayerId: parsed.walkoverAbsentPlayerId,
        });

        await app.db.insert(schema.auditEvents).values({
          editionId: match.editionId,
          matchId: match.id,
          eventType: 'MATCH_WALKOVER',
          payload: {
            submittedByPlayerId: playerId,
            absentPlayerId: parsed.walkoverAbsentPlayerId,
          },
          createdBy: playerId,
        });

        await emitMatchConfirmed(app, confirmed.editionId, {
          matchId: confirmed.match.id,
          groupId: confirmed.groupId,
        });

        return { match: confirmed.match };
      }

      const { playerOneSets, playerTwoSets } = {
        playerOneSets: parsed.playerOneSets,
        playerTwoSets: parsed.playerTwoSets,
      };

      const now = new Date();

      await app.db.transaction(async (tx) => {
        const claimed = await tx
          .update(schema.matches)
          .set({ status: 'AGUARDANDO_CONFIRMACAO', updatedAt: now })
          .where(and(eq(schema.matches.id, match.id), eq(schema.matches.status, 'AGENDADA')))
          .returning({ id: schema.matches.id });

        if (!claimed[0]) {
          throw conflict('Esta partida mudou de estado. Atualize e tente novamente.');
        }

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

      await emitMatchResultSubmitted(app, match.editionId, { matchId: match.id });

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

      const confirmed = await confirmMatchResult(app.db, match.id, playerId, 'MATCH_CONFIRMED', {
        expectedStatuses: ['AGUARDANDO_CONFIRMACAO'],
      });
      await emitMatchConfirmed(app, confirmed.editionId, {
        matchId: confirmed.match.id,
        groupId: confirmed.groupId,
      });

      return { match: confirmed.match };
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
        const claimed = await tx
          .update(schema.matches)
          .set({ status: 'CONTESTADA', updatedAt: now })
          .where(
            and(
              eq(schema.matches.id, match.id),
              eq(schema.matches.status, 'AGUARDANDO_CONFIRMACAO'),
            ),
          )
          .returning({ id: schema.matches.id });

        if (!claimed[0]) {
          throw conflict('Esta partida mudou de estado. Atualize e tente novamente.');
        }

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

      await emitMatchContested(app, match.editionId, { matchId: match.id });

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

      const organizerRecordableStatuses = new Set<typeof match.status>([
        'AGENDADA',
        'AGUARDANDO_CONFIRMACAO',
        'CONTESTADA',
      ]);

      if (!organizerRecordableStatuses.has(match.status)) {
        throw conflict('Esta partida não pode ser alterada pelo organizador.');
      }

      const [edition] = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.id, match.editionId))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      const participantCount = await countEditionRegistrations(app.db, match.editionId);
      const bestOf = resolveMatchBestOf(normalizeEditionRules(edition.rules), participantCount);

      const parsed = parseOrganizerMatchCorrection(
        request.body,
        match.playerOneId,
        match.playerTwoId,
        bestOf,
      );

      const organizer = request.organizerEmail ?? 'organizer';
      const previousStatus = match.status;
      const auditEventType =
        previousStatus === 'CONTESTADA' ? 'MATCH_CORRECTED' : 'MATCH_ORGANIZER_RECORDED';
      const resultingStatus = previousStatus === 'CONTESTADA' ? 'CORRIGIDA' : 'CONFIRMADA';

      const confirmed = await confirmMatchResult(app.db, match.id, organizer, auditEventType, {
        expectedStatuses: [previousStatus],
        resultingStatus,
        correctedSets: {
          playerOneSets: parsed.playerOneSets,
          playerTwoSets: parsed.playerTwoSets,
        },
        outcome: parsed.outcome,
        walkoverAbsentPlayerId: parsed.walkoverAbsentPlayerId,
        auditExtras: {
          previousStatus,
          outcome: parsed.outcome,
          overwrotePlayerSubmission: previousStatus === 'AGUARDANDO_CONFIRMACAO',
        },
      });
      await emitMatchConfirmed(app, confirmed.editionId, {
        matchId: confirmed.match.id,
        groupId: confirmed.groupId,
      });

      return { match: confirmed.match };
    },
  );
}
