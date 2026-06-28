import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ChampionshipEditionsResponseSchema,
  ChampionshipListResponseSchema,
  ChampionshipRankingResponseSchema,
  ChampionshipSchema,
  CreateChampionshipBodySchema,
  CreatePlayerBodySchema,
  ErrorResponseSchema,
  ImportScoresResponseSchema,
  OrganizerSessionResponseSchema,
  PlayerListResponseSchema,
  PlayerSchema,
  RequestOrganizerMagicLinkBodySchema,
  RequestOrganizerMagicLinkResponseSchema,
  UpdateScoringTableBodySchema,
  validatePlayerName,
  VerifyOrganizerMagicLinkBodySchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import {
  generateSecureToken,
  hashToken,
  isOrganizerEmailAllowed,
  normalizeEmail,
} from '../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { mapChampionship, mapEditionSummary, mapPlayer } from '../lib/mappers.js';
import { parseImportScoresCsv } from '../lib/csv.js';
import { consumeMagicToken } from '../plugins/auth.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  const authRateLimit = {
    rateLimit: {
      max: app.config.authRateLimitMax,
      timeWindow: app.config.authRateLimitWindowMinutes * 60_000,
    },
  };

  typed.post(
    '/auth/organizer/magic-link',
    {
      config: authRateLimit,
      schema: {
        body: RequestOrganizerMagicLinkBodySchema,
        response: {
          200: RequestOrganizerMagicLinkResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const email = normalizeEmail(request.body.email);

      if (!isOrganizerEmailAllowed(email, app.config.organizerAllowedEmails)) {
        throw forbidden('Este e-mail não está autorizado a acessar o painel do organizador.');
      }

      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + app.config.organizerMagicLinkTtlMinutes * 60_000);

      await app.db.insert(schema.organizerMagicTokens).values({
        email,
        tokenHash: hashToken(token),
        expiresAt,
      });

      const verifyUrl = `${app.config.publicAppUrl}/organizador/entrar?token=${encodeURIComponent(token)}`;
      request.log.info({ email, verifyUrl }, 'Magic link gerado para organizador');

      return {
        message:
          'Verifique seu e-mail, se ele estiver autorizado, um link de acesso terá sido enviado para você.',
        expiresInMinutes: app.config.organizerMagicLinkTtlMinutes,
        ...(app.config.exposeMagicLinks ? { magicLink: verifyUrl } : {}),
      };
    },
  );

  typed.post(
    '/auth/organizer/verify',
    {
      config: authRateLimit,
      schema: {
        body: VerifyOrganizerMagicLinkBodySchema,
        response: {
          200: OrganizerSessionResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const consumed = await consumeMagicToken(app, request.body.token);
      if (!consumed) {
        throw unauthorized('Link inválido, expirado ou já utilizado.');
      }

      const sessionToken = generateSecureToken();
      const expiresAt = new Date(Date.now() + app.config.organizerSessionTtlHours * 3_600_000);

      await app.db.insert(schema.organizerSessions).values({
        email: consumed.email,
        tokenHash: hashToken(sessionToken),
        expiresAt,
      });

      return {
        sessionToken,
        email: consumed.email,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );
}

export async function registerPlayerRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/players',
    {
      schema: {
        response: {
          200: PlayerListResponseSchema,
        },
      },
    },
    async () => {
      const rows = await app.db.select().from(schema.players).orderBy(schema.players.name);
      return { players: rows.map(mapPlayer) };
    },
  );

  typed.get(
    '/players/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: PlayerSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const [row] = await app.db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, request.params.id))
        .limit(1);

      if (!row) {
        throw notFound('Jogador não encontrado.');
      }

      return mapPlayer(row);
    },
  );

  typed.post(
    '/players',
    {
      preHandler: app.requireOrganizer,
      schema: {
        body: CreatePlayerBodySchema,
        response: {
          201: PlayerSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const nameValidation = validatePlayerName(request.body.name);
      if (!nameValidation.ok) {
        throw badRequest(nameValidation.error);
      }

      const name = nameValidation.name;

      try {
        const [row] = await app.db.insert(schema.players).values({ name }).returning();

        if (!row) {
          throw badRequest('Não foi possível criar o jogador.');
        }

        reply.code(201);
        return mapPlayer(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Já existe um jogador com este nome.');
        }

        throw error;
      }
    },
  );
}

export async function registerChampionshipRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  const championshipIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

  typed.get(
    '/championships',
    {
      schema: {
        response: {
          200: ChampionshipListResponseSchema,
        },
      },
    },
    async () => {
      const rows = await app.db
        .select()
        .from(schema.championships)
        .orderBy(schema.championships.createdAt);
      return { championships: rows.map(mapChampionship) };
    },
  );

  typed.get(
    '/championships/:id',
    {
      schema: {
        params: championshipIdParams,
        response: {
          200: ChampionshipSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const [row] = await app.db
        .select()
        .from(schema.championships)
        .where(eq(schema.championships.id, request.params.id))
        .limit(1);

      if (!row) {
        throw notFound('Campeonato não encontrado.');
      }

      return mapChampionship(row);
    },
  );

  typed.get(
    '/championships/:id/editions',
    {
      schema: {
        params: championshipIdParams,
        response: {
          200: ChampionshipEditionsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const championshipId = request.params.id;
      const [championship] = await app.db
        .select({ id: schema.championships.id })
        .from(schema.championships)
        .where(eq(schema.championships.id, championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      const editionRows = await app.db
        .select()
        .from(schema.editions)
        .where(eq(schema.editions.championshipId, championshipId))
        .orderBy(desc(schema.editions.date), desc(schema.editions.createdAt));

      return {
        championshipId,
        editions: editionRows.map(mapEditionSummary),
      };
    },
  );

  typed.get(
    '/championships/:id/ranking',
    {
      schema: {
        params: championshipIdParams,
        response: {
          200: ChampionshipRankingResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const championshipId = request.params.id;
      const [championship] = await app.db
        .select({ id: schema.championships.id })
        .from(schema.championships)
        .where(eq(schema.championships.id, championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      const rows = await app.db
        .select({
          playerId: schema.championshipPlayerPoints.playerId,
          playerName: schema.players.name,
          accumulatedPoints: schema.championshipPlayerPoints.accumulatedPoints,
        })
        .from(schema.championshipPlayerPoints)
        .innerJoin(schema.players, eq(schema.championshipPlayerPoints.playerId, schema.players.id))
        .where(eq(schema.championshipPlayerPoints.championshipId, championshipId))
        .orderBy(desc(schema.championshipPlayerPoints.accumulatedPoints), asc(schema.players.name));

      return {
        championshipId,
        ranking: rows.map((row, index) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          accumulatedPoints: row.accumulatedPoints,
          rank: index + 1,
        })),
      };
    },
  );

  typed.post(
    '/championships',
    {
      preHandler: app.requireOrganizer,
      schema: {
        body: CreateChampionshipBodySchema,
        response: {
          201: ChampionshipSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { validateScoringTable } = await import('../lib/errors.js');
      const scoringTable = request.body.scoringTable;

      if (scoringTable) {
        const scoringError = validateScoringTable(scoringTable);
        if (scoringError) {
          throw badRequest(scoringError);
        }
      }

      try {
        const [row] = await app.db
          .insert(schema.championships)
          .values({
            name: request.body.name.trim(),
            ...(scoringTable ? { scoringTable } : {}),
            ...(request.body.defaultEditionRules
              ? { defaultEditionRules: request.body.defaultEditionRules }
              : {}),
          })
          .returning();

        if (!row) {
          throw badRequest('Não foi possível criar o campeonato.');
        }

        reply.code(201);
        return mapChampionship(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Já existe um campeonato com este nome.');
        }

        throw error;
      }
    },
  );

  typed.put(
    '/championships/:id/scoring-table',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: championshipIdParams,
        body: UpdateScoringTableBodySchema,
        response: {
          200: ChampionshipSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { validateScoringTable } = await import('../lib/errors.js');
      const scoringError = validateScoringTable(request.body.scoringTable);
      if (scoringError) {
        throw badRequest(scoringError);
      }

      const [row] = await app.db
        .update(schema.championships)
        .set({ scoringTable: request.body.scoringTable })
        .where(eq(schema.championships.id, request.params.id))
        .returning();

      if (!row) {
        throw notFound('Campeonato não encontrado.');
      }

      return mapChampionship(row);
    },
  );

  typed.post(
    '/championships/:id/import-scores',
    {
      preHandler: app.requireOrganizer,
      bodyLimit: app.config.csvImportMaxBytes,
      schema: {
        params: championshipIdParams,
        response: {
          200: ImportScoresResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const championshipId = request.params.id;
      const [championship] = await app.db
        .select({ id: schema.championships.id })
        .from(schema.championships)
        .where(eq(schema.championships.id, championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      const csvContent = typeof request.body === 'string' ? request.body : '';
      if (!csvContent.trim()) {
        throw badRequest('Envie o conteúdo CSV no corpo da requisição com Content-Type text/csv.');
      }

      const parsedRows = parseImportScoresCsv(csvContent);
      const importedScores: Array<{ playerName: string; accumulatedPoints: number }> = [];
      let createdPlayersCount = 0;
      let skippedExistingCount = 0;

      await app.db.transaction(async (tx) => {
        for (const row of parsedRows) {
          const playerName = row.playerName;
          let [player] = await tx
            .select({ id: schema.players.id, name: schema.players.name })
            .from(schema.players)
            .where(sql`upper(trim(${schema.players.name})) = ${playerName}`)
            .limit(1);

          if (!player) {
            const [created] = await tx
              .insert(schema.players)
              .values({ name: playerName })
              .returning({ id: schema.players.id, name: schema.players.name });

            if (!created) {
              throw badRequest(
                `Linha ${row.lineNumber}: não foi possível cadastrar "${playerName}".`,
              );
            }

            player = created;
            createdPlayersCount += 1;
          }

          const [existingPoints] = await tx
            .select({ playerId: schema.championshipPlayerPoints.playerId })
            .from(schema.championshipPlayerPoints)
            .where(
              and(
                eq(schema.championshipPlayerPoints.championshipId, championshipId),
                eq(schema.championshipPlayerPoints.playerId, player.id),
              ),
            )
            .limit(1);

          if (existingPoints) {
            skippedExistingCount += 1;
            continue;
          }

          await tx.insert(schema.championshipPlayerPoints).values({
            championshipId,
            playerId: player.id,
            accumulatedPoints: row.accumulatedPoints,
          });

          importedScores.push({
            playerName: player.name,
            accumulatedPoints: row.accumulatedPoints,
          });
        }

        await tx.insert(schema.auditEvents).values({
          championshipId,
          eventType: 'CSV_IMPORTED',
          payload: {
            importedCount: importedScores.length,
            createdPlayersCount,
            skippedExistingCount,
            scores: importedScores,
          },
          createdBy: request.organizerEmail ?? 'organizer',
        });
      });

      return {
        championshipId,
        importedCount: importedScores.length,
        createdPlayersCount,
        skippedExistingCount,
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
