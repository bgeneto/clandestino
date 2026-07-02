import type { FastifyInstance } from 'fastify';
import { createDb, createSqlite, type Db } from '../db/index.js';
import type { ApiConfig } from '../config.js';
import type { EmailSender } from '../lib/email.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: ApiConfig;
    db: Db;
    emailSender: EmailSender;
  }
}

export async function registerConfigPlugin(
  app: FastifyInstance,
  config: ApiConfig,
  emailSender: EmailSender,
): Promise<void> {
  app.decorate('config', config);
  app.decorate('emailSender', emailSender);
}

export async function registerDbPlugin(app: FastifyInstance): Promise<void> {
  const sqlite = createSqlite(app.config.databaseUrl);
  const db = createDb(sqlite);

  app.decorate('db', db);
  app.addHook('onClose', async () => {
    sqlite.close();
  });
}
