import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type SqliteDatabase = Database.Database;

export type Db = ReturnType<typeof drizzle<typeof schema>>;
type TransactionCallback = Parameters<Db['transaction']>[0];
type TransactionConfig = Parameters<Db['transaction']>[1];

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to the database');
  }

  return databaseUrl;
}

export function resolveSqlitePath(databaseUrl: string): string {
  if (databaseUrl.startsWith('file:')) {
    const rawPath = databaseUrl.slice('file:'.length);
    if (rawPath.startsWith('//')) {
      return fileURLToPath(databaseUrl);
    }
    return resolve(process.cwd(), rawPath);
  }

  if (isAbsolute(databaseUrl)) {
    return databaseUrl;
  }

  return resolve(process.cwd(), databaseUrl);
}

export function createSqlite(databaseUrl = getDatabaseUrl()): SqliteDatabase {
  const filePath = resolveSqlitePath(databaseUrl);
  mkdirSync(dirname(filePath), { recursive: true });

  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return sqlite;
}

function beginStatement(behavior: 'deferred' | 'immediate' | 'exclusive' = 'deferred'): string {
  if (behavior === 'immediate') {
    return 'BEGIN IMMEDIATE';
  }
  if (behavior === 'exclusive') {
    return 'BEGIN EXCLUSIVE';
  }
  return 'BEGIN';
}

export function createDb(sqlite: SqliteDatabase = createSqlite()): Db {
  const db = drizzle(sqlite, { schema });

  return Object.assign(db, {
    transaction<T>(
      fn: (tx: Parameters<TransactionCallback>[0]) => T | Promise<T>,
      config?: TransactionConfig,
    ): T | Promise<T> {
      sqlite.exec(beginStatement(config?.behavior));
      try {
        const result = fn(db as unknown as Parameters<TransactionCallback>[0]);
        if (result instanceof Promise) {
          return result.then(
            (value) => {
              sqlite.exec('COMMIT');
              return value;
            },
            (error) => {
              sqlite.exec('ROLLBACK');
              throw error;
            },
          );
        }
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  }) as Db;
}

export { schema };
