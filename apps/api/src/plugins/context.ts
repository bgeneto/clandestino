import type { FastifyInstance } from 'fastify';
import { createDb, createPool, type Db } from '../db/index.js';
import type { ApiConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: ApiConfig;
    db: Db;
  }
}

export async function registerConfigPlugin(
  app: FastifyInstance,
  config: ApiConfig,
): Promise<void> {
  app.decorate('config', config);
}

export async function registerDbPlugin(app: FastifyInstance): Promise<void> {
  const pool = createPool(app.config.databaseUrl);
  const db = createDb(pool);

  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await pool.end();
  });
}
