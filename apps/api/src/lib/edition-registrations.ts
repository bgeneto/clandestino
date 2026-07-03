import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';

type DbExecutor = Pick<FastifyInstance['db'], 'select'>;

export async function loadWithdrawnPlayerIds(
  db: DbExecutor,
  editionId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({
      playerId: schema.editionRegistrations.playerId,
      withdrawnAt: schema.editionRegistrations.withdrawnAt,
    })
    .from(schema.editionRegistrations)
    .where(eq(schema.editionRegistrations.editionId, editionId));

  return new Set(rows.filter((row) => row.withdrawnAt !== null).map((row) => row.playerId));
}

export async function loadWithdrawnPlayers(
  db: DbExecutor,
  editionId: string,
): Promise<Array<{ playerId: string; withdrawnAt: Date }>> {
  const rows = await db
    .select()
    .from(schema.editionRegistrations)
    .where(eq(schema.editionRegistrations.editionId, editionId));

  return rows
    .filter((row) => row.withdrawnAt !== null)
    .map((row) => ({
      playerId: row.playerId,
      withdrawnAt: row.withdrawnAt!,
    }));
}
