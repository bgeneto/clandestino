import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createNoopEmailSender, type EmailSender } from '../lib/email.js';
import { resolveSqlitePath } from '../db/index.js';

/**
 * URL do banco dedicado aos testes de integração. Quando ausente, a suíte é
 * ignorada via `describe.skipIf(!hasTestDb)`, mantendo `pnpm test` verde sem
 * arquivo de teste configurado.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const hasTestDb = Boolean(testDatabaseUrl);

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const TRUNCATE_ORDER = [
  'audit_event',
  'organizer_session',
  'organizer_magic_token',
  'championship_player_points',
  'final_placement',
  'standing',
  'match_participant',
  'match',
  'group_player',
  '"group"',
  'draw_snapshot',
  'edition_registration',
  'edition',
  'championship',
  'player',
];

let testSqlite: Database.Database | undefined;
let migrated = false;

function getTestSqlite(): Database.Database {
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL não definida; não é possível abrir o banco de testes.');
  }
  if (!testSqlite) {
    const filePath = resolveSqlitePath(testDatabaseUrl);
    testSqlite = new Database(filePath);
    testSqlite.pragma('journal_mode = WAL');
    testSqlite.pragma('foreign_keys = ON');
  }
  return testSqlite;
}

/** Aplica as migrações Drizzle no banco de testes (idempotente por processo). */
export async function migrateTestDb(): Promise<void> {
  if (migrated) {
    return;
  }
  const sqlite = getTestSqlite();
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  migrated = true;
}

/** Limpa todas as tabelas entre os testes, preservando o schema. */
export async function truncateAll(): Promise<void> {
  const sqlite = getTestSqlite();
  sqlite.exec('PRAGMA foreign_keys = OFF');
  try {
    for (const table of TRUNCATE_ORDER) {
      sqlite.exec(`DELETE FROM ${table}`);
    }
  } finally {
    sqlite.exec('PRAGMA foreign_keys = ON');
  }
}

export async function adminQuery(
  text: string,
  params: unknown[] = [],
): Promise<Array<Record<string, unknown>>> {
  const sqlite = getTestSqlite();
  const stmt = sqlite.prepare(text);
  const verb = text.trimStart().split(/\s+/)[0]?.toUpperCase();
  if (verb === 'SELECT' || verb === 'WITH') {
    return stmt.all(...params) as Array<Record<string, unknown>>;
  }
  stmt.run(...params);
  return [];
}

export async function closeTestDb(): Promise<void> {
  if (testSqlite) {
    testSqlite.close();
    testSqlite = undefined;
    migrated = false;
  }
}

/** Cria uma instância isolada da API apontando para o banco de testes. */
export async function createTestApp(
  envOverrides: Record<string, string> = {},
  options?: { emailSender?: EmailSender },
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
  const app = await createApp(config, {
    emailSender: options?.emailSender ?? createNoopEmailSender(),
  });
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

export function getCreatedEditionId(body: { editions: Array<{ id: string }> }): string {
  const edition = body.editions[0];
  if (!edition) {
    throw new Error('Resposta de criação de edição sem editions[0].');
  }

  return edition.id;
}
