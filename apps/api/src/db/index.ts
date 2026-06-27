import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL');
  }

  return databaseUrl;
}

export function createPool(databaseUrl = getDatabaseUrl()): Pool {
  return new Pool({ connectionString: databaseUrl });
}

export function createDb(pool = createPool()) {
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;

export { schema };
