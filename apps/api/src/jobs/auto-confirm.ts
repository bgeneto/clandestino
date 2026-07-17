import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { confirmMatchResult } from '../lib/matches.js';
import { emitMatchConfirmed } from '../lib/sse-events.js';

const AUTO_CONFIRM_INTERVAL_MS = 60_000;
const AUTO_CONFIRM_ACTOR = 'system';

export function startAutoConfirmJob(app: FastifyInstance): () => void {
  const run = () => {
    void runAutoConfirmCycle(app).catch((error) => {
      app.log.error({ err: error }, 'Falha no job de auto-confirmação.');
    });
  };

  run();
  const timer = setInterval(run, AUTO_CONFIRM_INTERVAL_MS);

  return () => {
    clearInterval(timer);
  };
}

export async function runAutoConfirmCycle(app: FastifyInstance): Promise<number> {
  const now = new Date();

  const expiredMatches = await app.db
    .select({
      matchId: schema.matches.id,
    })
    .from(schema.matches)
    .innerJoin(schema.editions, eq(schema.matches.editionId, schema.editions.id))
    .where(
      and(
        eq(schema.matches.status, 'AGUARDANDO_CONFIRMACAO'),
        sql`${schema.matches.updatedAt} <= (${now.getTime()} - ${schema.editions.autoConfirmMinutes} * 60000)`,
      ),
    );

  let confirmedCount = 0;

  for (const { matchId } of expiredMatches) {
    try {
      const result = await confirmMatchResult(
        app.db,
        matchId,
        AUTO_CONFIRM_ACTOR,
        'AUTO_CONFIRMED',
        { expectedStatuses: ['AGUARDANDO_CONFIRMACAO'] },
      );

      await emitMatchConfirmed(app, result.editionId, {
        matchId: result.match.id,
        groupId: result.groupId,
      });

      confirmedCount += 1;
    } catch (error) {
      app.log.warn({ err: error, matchId }, 'Não foi possível auto-confirmar partida.');
    }
  }

  return confirmedCount;
}
