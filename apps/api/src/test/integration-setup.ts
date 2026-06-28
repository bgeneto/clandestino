import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * URL do banco dedicado aos testes de integração. Quando ausente, a suíte é
 * ignorada via `describe.skipIf(!hasTestDb)`, mantendo `pnpm test` verde em
 * ambientes sem PostgreSQL.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const hasTestDb = Boolean(testDatabaseUrl);

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const ALL_TABLES = [
  'player',
  'championship',
  'edition',
  'edition_registration',
  'draw_snapshot',
  '"group"',
  'group_player',
  'match',
  'match_participant',
  'standing',
  'final_placement',
  'championship_player_points',
  'organizer_magic_token',
  'organizer_session',
  'audit_event',
];

let adminPool: Pool | undefined;
let migrated = false;

function getAdminPool(): Pool {
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL não definida; não é possível abrir o pool de testes.');
  }
  if (!adminPool) {
    adminPool = new Pool({ connectionString: testDatabaseUrl });
  }
  return adminPool;
}

/** Aplica as migrações Drizzle no banco de testes (idempotente por processo). */
export async function migrateTestDb(): Promise<void> {
  if (migrated) {
    return;
  }
  const pool = getAdminPool();
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  migrated = true;
}

/** Limpa todas as tabelas entre os testes, preservando o schema. */
export async function truncateAll(): Promise<void> {
  const pool = getAdminPool();
  await pool.query(`TRUNCATE TABLE ${ALL_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function adminQuery(
  text: string,
  params: unknown[] = [],
): Promise<Array<Record<string, unknown>>> {
  const pool = getAdminPool();
  const result = await pool.query(text, params);
  return result.rows;
}

export async function closeAdminPool(): Promise<void> {
  if (adminPool) {
    await adminPool.end();
    adminPool = undefined;
  }
}

/** Cria uma instância isolada da API apontando para o banco de testes. */
export async function createTestApp(
  envOverrides: Record<string, string> = {},
): Promise<FastifyInstance> {
  const config = loadConfig({
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    NODE_ENV: 'test',
    // Limite alto por padrão para não interferir nos logins entre testes;
    // o teste de rate limit sobrescreve com um valor baixo.
    AUTH_RATE_LIMIT_MAX: '1000',
    ...envOverrides,
  });
  const app = await createApp(config);
  await app.ready();
  return app;
}

/** Executa o fluxo real de magic link e retorna um sessionToken de organizador. */
export async function loginOrganizer(
  app: FastifyInstance,
  email = 'organizador@gmail.com',
): Promise<string> {
  const requested = await app.inject({
    method: 'POST',
    url: '/auth/organizer/magic-link',
    payload: { email },
  });

  const magicLink = requested.json<{ magicLink?: string }>().magicLink;
  if (!magicLink) {
    throw new Error('Magic link não exposto na resposta de teste.');
  }

  const token = new URL(magicLink).searchParams.get('token');
  if (!token) {
    throw new Error('Token ausente no magic link de teste.');
  }

  const verified = await app.inject({
    method: 'POST',
    url: '/auth/organizer/verify',
    payload: { token },
  });

  return verified.json<{ sessionToken: string }>().sessionToken;
}

export function organizerHeaders(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export function playerHeaders(playerId: string, editionId: string): Record<string, string> {
  return { 'x-player-id': playerId, 'x-edition-id': editionId };
}
