import type { FastifyInstance } from 'fastify';
import { createDb, createSqlite, type Db } from '../db/index.js';
import type { ApiConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: ApiConfig;
    db: Db;
  }
}

export async function registerConfigPlugin(app: FastifyInstance, config: ApiConfig): Promise<void> {
  app.decorate('config', config);
}

export async function registerDbPlugin(app: FastifyInstance): Promise<void> {
  const sqlite = createSqlite(app.config.databaseUrl);
  const db = createDb(sqlite);

  app.decorate('db', db);
  app.addHook('onClose', async () => {
    sqlite.close();
  });
}
