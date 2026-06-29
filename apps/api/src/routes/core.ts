import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ArchiveChampionshipResponseSchema,
  ChampionshipEditionsResponseSchema,
  ChampionshipListResponseSchema,
  ChampionshipRankingResponseSchema,
  ChampionshipRosterResponseSchema,
  ChampionshipSchema,
  CreateChampionshipBodySchema,
  CreatePlayerBodySchema,
  DeleteChampionshipResponseSchema,
  ErrorResponseSchema,
  ImportScoresResponseSchema,
  OrganizerSessionResponseSchema,
  OrganizerSessionStatusSchema,
  PlayerListResponseSchema,
  PlayerSchema,
  RequestOrganizerMagicLinkBodySchema,
  RequestOrganizerMagicLinkResponseSchema,
  UnarchiveChampionshipResponseSchema,
  UpdateScoringTableBodySchema,
  validatePlayerName,
  PLAYER_NAME_DUPLICATE_MESSAGE,
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
import {
  badRequest,
  conflict,
  forbidden,
  isUniqueViolation,
  notFound,
  unauthorized,
} from '../lib/errors.js';
import { mapChampionship, mapEditionSummary, mapPlayer } from '../lib/mappers.js';
import { parseImportScoresCsv } from '../lib/csv.js';
import { listChampionshipRoster } from '../lib/championship-roster.js';
import { findOrCreatePlayerByName, findPlayerByNormalizedName } from '../lib/players.js';
import { consumeMagicToken, resolveOrganizerSession } from '../plugins/auth.js';

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
          'Verifique seu e-mail. Se ele estiver autorizado, um link de acesso terá sido enviado para você.',
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

  typed.get(
    '/auth/organizer/session',
    {
      schema: {
        response: {
          200: OrganizerSessionStatusSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw unauthorized();
      }

      const token = header.slice('Bearer '.length).trim();
      if (!token) {
        throw unauthorized();
      }

      const session = await resolveOrganizerSession(app, token);
      if (!session) {
        throw unauthorized('Sessão de organizador inválida ou expirada.');
      }

      return {
        email: session.email,
        expiresAt: session.expiresAt.toISOString(),
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

      const existing = await findPlayerByNormalizedName(app.db, name);
      if (existing) {
        throw conflict(PLAYER_NAME_DUPLICATE_MESSAGE);
      }

      try {
        const [row] = await app.db.insert(schema.players).values({ name }).returning();

        if (!row) {
          throw badRequest('Não foi possível criar o jogador.');
        }

        reply.code(201);
        return mapPlayer(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict(PLAYER_NAME_DUPLICATE_MESSAGE);
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

  typed.get(
    '/championships/:id/roster',
    {
      schema: {
        params: championshipIdParams,
        response: {
          200: ChampionshipRosterResponseSchema,
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

      const roster = await listChampionshipRoster(app.db, championshipId);

      return {
        championshipId,
        roster,
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

  typed.delete(
    '/championships/:id',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: championshipIdParams,
        response: {
          200: DeleteChampionshipResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
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

      const [editionCountRow, pointsCountRow] = await Promise.all([
        app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.editions)
          .where(eq(schema.editions.championshipId, championshipId)),
        app.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.championshipPlayerPoints)
          .where(eq(schema.championshipPlayerPoints.championshipId, championshipId)),
      ]);

      const editionCount = editionCountRow[0]?.count ?? 0;
      const pointsCount = pointsCountRow[0]?.count ?? 0;

      if (editionCount > 0) {
        throw conflict('Não é possível excluir um campeonato que possui edições.');
      }

      if (pointsCount > 0) {
        throw conflict('Não é possível excluir um campeonato que possui pontuações importadas.');
      }

      await app.db.delete(schema.championships).where(eq(schema.championships.id, championshipId));

      return {
        id: championshipId,
        deletedAt: new Date().toISOString(),
      };
    },
  );

  typed.post(
    '/championships/:id/archive',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: championshipIdParams,
        response: {
          200: ArchiveChampionshipResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const championshipId = request.params.id;
      const [championship] = await app.db
        .select({ id: schema.championships.id, archivedAt: schema.championships.archivedAt })
        .from(schema.championships)
        .where(eq(schema.championships.id, championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      if (championship.archivedAt) {
        throw conflict('Campeonato já está arquivado.');
      }

      const archivedAt = new Date();
      const [row] = await app.db
        .update(schema.championships)
        .set({ archivedAt })
        .where(eq(schema.championships.id, championshipId))
        .returning();

      return {
        id: championshipId,
        archivedAt: row!.archivedAt!.toISOString(),
      };
    },
  );

  typed.post(
    '/championships/:id/unarchive',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: championshipIdParams,
        response: {
          200: UnarchiveChampionshipResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const championshipId = request.params.id;
      const [championship] = await app.db
        .select({ id: schema.championships.id, archivedAt: schema.championships.archivedAt })
        .from(schema.championships)
        .where(eq(schema.championships.id, championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      if (!championship.archivedAt) {
        throw conflict('Campeonato não está arquivado.');
      }

      await app.db
        .update(schema.championships)
        .set({ archivedAt: null })
        .where(eq(schema.championships.id, championshipId));

      return {
        id: championshipId,
        archivedAt: null,
      };
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
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const championshipId = request.params.id;
      const [championship] = await app.db
        .select({ id: schema.championships.id, archivedAt: schema.championships.archivedAt })
        .from(schema.championships)
        .where(eq(schema.championships.id, championshipId))
        .limit(1);

      if (!championship) {
        throw notFound('Campeonato não encontrado.');
      }

      if (championship.archivedAt) {
        throw conflict('Não é possível importar pontuação em um campeonato arquivado.');
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
          const { player, created } = await findOrCreatePlayerByName(
            tx,
            row.playerName,
            row.lineNumber,
          );

          if (created) {
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
