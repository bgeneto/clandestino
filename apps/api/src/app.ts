import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { ApiConfig } from './config.js';
import { ApiError } from './lib/errors.js';
import { createEmailSender, type EmailSender } from './lib/email.js';
import { registerAuthHooks } from './plugins/auth.js';
import { registerConfigPlugin, registerDbPlugin } from './plugins/context.js';
import {
  registerAuthRoutes,
  registerPlayerRoutes,
  registerChampionshipRoutes,
} from './routes/core.js';
import { registerEditionRoutes } from './routes/editions.js';
import { registerEditionDrawRoutes } from './routes/edition-draw.js';
import { registerEditionPlacementRoutes } from './routes/edition-placement.js';
import { registerEditionWithdrawalRoutes } from './routes/edition-withdrawals.js';
import { registerEditionReadRoutes } from './routes/edition-read.js';
import { registerMatchRoutes } from './routes/matches.js';
import { registerOrganizerDashboardRoutes } from './routes/organizer-dashboard.js';
import { registerSsePlugin } from './plugins/sse.js';
import { startAutoConfirmJob } from './jobs/auto-confirm.js';

export async function createApp(config: ApiConfig, options?: { emailSender?: EmailSender }) {
  const app = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  app.addContentTypeParser('application/csv', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  const emailSender = options?.emailSender ?? createEmailSender(config);
  await registerConfigPlugin(app, config, emailSender);

  // Rate limiting desativado por padrão (global: false); habilitado por rota
  // (ver rotas de magic link) para evitar abuso/spam sem afetar SSE e leitura.
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => {
      const message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      // Inclui statusCode/message para que tanto o envio direto do plugin quanto
      // o caminho de erro do Fastify resultem em 429 com corpo { error }.
      return { statusCode: 429, error: message, message };
    },
  });

  await registerDbPlugin(app);
  await registerSsePlugin(app);
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

    // Erros do próprio Fastify (ex.: corpo grande demais → 413) trazem um
    // statusCode 4xx. Honramos esse código em vez de mascarar como 500.
    const frameworkError = error as { statusCode?: number; message?: string };
    if (
      typeof frameworkError.statusCode === 'number' &&
      frameworkError.statusCode >= 400 &&
      frameworkError.statusCode < 500
    ) {
      reply.code(frameworkError.statusCode).send({
        error: frameworkError.message || 'Requisição inválida.',
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
  await registerChampionshipRoutes(app);
  await registerEditionRoutes(app);
  await registerEditionDrawRoutes(app);
  await registerEditionReadRoutes(app);
  await registerMatchRoutes(app);
  await registerEditionPlacementRoutes(app);
  await registerEditionWithdrawalRoutes(app);
  await registerOrganizerDashboardRoutes(app);

  const stopAutoConfirmJob = startAutoConfirmJob(app);
  app.addHook('onClose', async () => {
    stopAutoConfirmJob();
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      error: 'Rota não encontrada.',
    });
  });

  return app;
}
