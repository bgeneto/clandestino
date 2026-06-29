import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { schema } from '../db/index.js';
import { hashToken } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }

  return null;
}

declare module 'fastify' {
  interface FastifyRequest {
    organizerEmail?: string;
    playerId?: string;
    playerEditionId?: string;
  }
}

export async function registerAuthHooks(app: FastifyInstance): Promise<void> {
  app.decorate(
    'requireOrganizer',
    async function requireOrganizer(request: FastifyRequest, reply: FastifyReply) {
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

      request.organizerEmail = session.email;
    },
  );

  app.decorate(
    'requirePlayer',
    async function requirePlayer(request: FastifyRequest, _reply: FastifyReply) {
      const playerId = readHeaderValue(request.headers['x-player-id']);
      const editionId = readHeaderValue(request.headers['x-edition-id']);

      if (!playerId || !editionId) {
        throw unauthorized('Sessão de jogador inválida.');
      }

      if (!UUID_PATTERN.test(playerId) || !UUID_PATTERN.test(editionId)) {
        throw unauthorized('Sessão de jogador inválida.');
      }

      const [registration] = await app.db
        .select({ playerId: schema.editionRegistrations.playerId })
        .from(schema.editionRegistrations)
        .where(
          and(
            eq(schema.editionRegistrations.editionId, editionId),
            eq(schema.editionRegistrations.playerId, playerId),
          ),
        )
        .limit(1);

      if (!registration) {
        throw forbidden('Jogador não inscrito nesta edição.');
      }

      request.playerId = playerId;
      request.playerEditionId = editionId;
    },
  );
}

declare module 'fastify' {
  interface FastifyInstance {
    requireOrganizer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePlayer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function resolveOrganizerSession(
  app: FastifyInstance,
  token: string,
): Promise<{ email: string; expiresAt: Date } | null> {
  const [session] = await app.db
    .select({
      email: schema.organizerSessions.email,
      expiresAt: schema.organizerSessions.expiresAt,
    })
    .from(schema.organizerSessions)
    .where(
      and(
        eq(schema.organizerSessions.tokenHash, hashToken(token)),
        gt(schema.organizerSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  return session;
}

export async function consumeMagicToken(
  app: FastifyInstance,
  token: string,
): Promise<{ email: string } | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [magicToken] = await app.db
    .select()
    .from(schema.organizerMagicTokens)
    .where(
      and(
        eq(schema.organizerMagicTokens.tokenHash, tokenHash),
        isNull(schema.organizerMagicTokens.usedAt),
        gt(schema.organizerMagicTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!magicToken) {
    return null;
  }

  await app.db
    .update(schema.organizerMagicTokens)
    .set({ usedAt: now })
    .where(eq(schema.organizerMagicTokens.id, magicToken.id));

  return { email: magicToken.email };
}
