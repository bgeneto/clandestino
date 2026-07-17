import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ErrorResponseSchema } from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import {
  SseHub,
  resolveSseResumeRevision,
  writeSseConnected,
  writeSseKeepAlive,
} from '../lib/sse.js';

const KEEP_ALIVE_INTERVAL_MS = 30_000;

declare module 'fastify' {
  interface FastifyInstance {
    sse: SseHub;
  }
}

export async function registerSsePlugin(app: FastifyInstance): Promise<void> {
  const hub = new SseHub();
  app.decorate('sse', hub);

  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/editions/:id/events',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        querystring: Type.Object({
          lastEventId: Type.Optional(Type.String()),
        }),
        response: {
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const editionId = request.params.id;

      const [edition] = await app.db
        .select({ id: schema.editions.id })
        .from(schema.editions)
        .where(eq(schema.editions.id, editionId))
        .limit(1);

      if (!edition) {
        throw notFound('Edição não encontrada.');
      }

      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      if (typeof reply.raw.flushHeaders === 'function') {
        reply.raw.flushHeaders();
      }

      // Last-Event-ID header is authoritative on browser auto-reconnect (SSE spec).
      // Query param covers our manual reconnect (new EventSource with ?lastEventId=).
      const lastRevision = resolveSseResumeRevision(
        request.headers['last-event-id'],
        request.query.lastEventId,
      );
      if (lastRevision > 0) {
        hub.replayAfter(editionId, lastRevision, reply.raw);
      }

      const client = hub.addClient(editionId, reply.raw);
      writeSseConnected(reply.raw);

      const keepAlive = setInterval(() => {
        if (reply.raw.writableEnded) {
          clearInterval(keepAlive);
          return;
        }

        try {
          writeSseKeepAlive(reply.raw);
        } catch {
          clearInterval(keepAlive);
          hub.removeClient(editionId, client);
        }
      }, KEEP_ALIVE_INTERVAL_MS);

      const cleanup = () => {
        clearInterval(keepAlive);
        hub.removeClient(editionId, client);
      };

      request.raw.on('close', cleanup);
      request.raw.on('error', cleanup);
    },
  );
}
