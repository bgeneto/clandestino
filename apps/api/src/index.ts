/**
 * Fastify API — T4+: jogadores, temporadas, edições, auth, importação CSV e sorteio.
 */
export { PlayerSchema, type Player } from '@clandestino/shared-contracts';
export { createDb, createPool, getDatabaseUrl, schema, type Db } from './db/index.js';
export { loadConfig, type ApiConfig } from './config.js';
export { createApp } from './app.js';
