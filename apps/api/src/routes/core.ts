import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  CreatePlayerBodySchema,
  CreateSeasonBodySchema,
  ErrorResponseSchema,
  OrganizerSessionResponseSchema,
  PlayerListResponseSchema,
  PlayerSchema,
  RequestOrganizerMagicLinkBodySchema,
  RequestOrganizerMagicLinkResponseSchema,
  SeasonListResponseSchema,
  SeasonSchema,
  UpdateScoringTableBodySchema,
  VerifyOrganizerMagicLinkBodySchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import {
  generateSecureToken,
  hashToken,
  isOrganizerEmailAllowed,
  normalizeEmail,
} from '../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { mapPlayer, mapSeason } from '../lib/mappers.js';
import { consumeMagicToken } from '../plugins/auth.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/auth/organizer/magic-link',
    {
      schema: {
        body: RequestOrganizerMagicLinkBodySchema,
        response: {
          200: RequestOrganizerMagicLinkResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
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
        message: 'Se o e-mail estiver autorizado, um link de acesso foi enviado.',
        expiresInMinutes: app.config.organizerMagicLinkTtlMinutes,
        ...(app.config.exposeMagicLinks ? { magicLink: verifyUrl } : {}),
      };
    },
  );

  typed.post(
    '/auth/organizer/verify',
    {
      schema: {
        body: VerifyOrganizerMagicLinkBodySchema,
        response: {
          200: OrganizerSessionResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
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
      const name = request.body.name.trim();

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

export async function registerSeasonRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/seasons',
    {
      schema: {
        response: {
          200: SeasonListResponseSchema,
        },
      },
    },
    async () => {
      const rows = await app.db.select().from(schema.seasons).orderBy(schema.seasons.createdAt);
      return { seasons: rows.map(mapSeason) };
    },
  );

  typed.post(
    '/seasons',
    {
      preHandler: app.requireOrganizer,
      schema: {
        body: CreateSeasonBodySchema,
        response: {
          201: SeasonSchema,
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
          .insert(schema.seasons)
          .values({
            name: request.body.name.trim(),
            ...(scoringTable ? { scoringTable } : {}),
          })
          .returning();

        if (!row) {
          throw badRequest('Não foi possível criar a temporada.');
        }

        reply.code(201);
        return mapSeason(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Já existe uma temporada com este nome.');
        }

        throw error;
      }
    },
  );

  typed.put(
    '/seasons/:id/scoring-table',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: UpdateScoringTableBodySchema,
        response: {
          200: SeasonSchema,
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
        .update(schema.seasons)
        .set({ scoringTable: request.body.scoringTable })
        .where(eq(schema.seasons.id, request.params.id))
        .returning();

      if (!row) {
        throw notFound('Temporada não encontrada.');
      }

      return mapSeason(row);
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
