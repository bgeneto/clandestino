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

type TxHandle = Parameters<TransactionCallback>[0];

export function createDb(sqlite: SqliteDatabase = createSqlite()): Db {
  const db = drizzle(sqlite, { schema });

  // Serializa transactions no mesmo connection SQLite. Sem isso, awaits dentro
  // de `transaction(async ...)` permitem outro BEGIN / queries de outro request
  // no meio da transação aberta ("cannot start a transaction within a transaction"
  // e commits cruzados).
  // Sempre retorna Promise: a fila de serialização exige isso; callers usam await.
  let transactionTail: Promise<unknown> = Promise.resolve();

  async function runInSavepoint<T>(
    fn: (tx: TxHandle) => T | Promise<T>,
    nestedIndex: number,
  ): Promise<T> {
    const savepointName = `sp${nestedIndex}`;
    sqlite.exec(`SAVEPOINT ${savepointName}`);
    try {
      const result = await fn(createTxHandle(nestedIndex + 1));
      sqlite.exec(`RELEASE SAVEPOINT ${savepointName}`);
      return result;
    } catch (error) {
      try {
        sqlite.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch {
        // savepoint pode já ter sido liberado
      }
      throw error;
    }
  }

  /** Handle passado ao callback: queries no `db`, nested `transaction` via SAVEPOINT. */
  function createTxHandle(nestedIndex: number): TxHandle {
    return new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'transaction') {
          return <T>(innerFn: (tx: TxHandle) => T | Promise<T>) =>
            runInSavepoint(innerFn, nestedIndex);
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as TxHandle;
  }

  return Object.assign(db, {
    transaction<T>(fn: (tx: TxHandle) => T | Promise<T>, config?: TransactionConfig): Promise<T> {
      const run = async (): Promise<T> => {
        sqlite.exec(beginStatement(config?.behavior ?? 'immediate'));
        try {
          const result = await fn(createTxHandle(1));
          sqlite.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            sqlite.exec('ROLLBACK');
          } catch {
            // conexão já pode estar sem transação aberta
          }
          throw error;
        }
      };

      const result = transactionTail.then(run, run);
      transactionTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  }) as Db;
}

export { schema };
