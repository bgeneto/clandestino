import Fastify from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { ApiConfig } from './config.js';
import { ApiError } from './lib/errors.js';
import { registerAuthHooks } from './plugins/auth.js';
import { registerConfigPlugin, registerDbPlugin } from './plugins/context.js';
import { registerAuthRoutes, registerPlayerRoutes, registerSeasonRoutes } from './routes/core.js';
import { registerEditionRoutes } from './routes/editions.js';
import { registerEditionDrawRoutes } from './routes/edition-draw.js';
import { registerEditionPlacementRoutes } from './routes/edition-placement.js';
import { registerMatchRoutes } from './routes/matches.js';

export async function createApp(config: ApiConfig) {
  const app = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.addContentTypeParser(
    'text/csv',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.addContentTypeParser(
    'application/csv',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, body);
    },
  );

  await registerConfigPlugin(app, config);
  await registerDbPlugin(app);
  await registerAuthHooks(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      reply.code(error.statusCode).send({
        error: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      });
      return;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      Array.isArray((error as { validation?: unknown }).validation)
    ) {
      reply.code(400).send({
        error: 'Dados da requisição inválidos.',
        details: (error as { validation: unknown }).validation,
      });
      return;
    }

    app.log.error(error);
    reply.code(500).send({
      error: 'Erro interno do servidor.',
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await registerAuthRoutes(app);
  await registerPlayerRoutes(app);
  await registerSeasonRoutes(app);
  await registerEditionRoutes(app);
  await registerEditionDrawRoutes(app);
  await registerMatchRoutes(app);
  await registerEditionPlacementRoutes(app);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      error: 'Rota não encontrada.',
    });
  });

  return app;
}
