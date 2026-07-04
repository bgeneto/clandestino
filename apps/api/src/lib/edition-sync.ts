import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { notFound } from './errors.js';

type EditionSyncDb = Pick<FastifyInstance['db'], 'select' | 'update'>;

export async function bumpEditionSyncRevision(
  db: EditionSyncDb,
  editionId: string,
): Promise<number> {
  const [row] = await db
    .update(schema.editions)
    .set({ syncRevision: sql`${schema.editions.syncRevision} + 1` })
    .where(eq(schema.editions.id, editionId))
    .returning({ syncRevision: schema.editions.syncRevision });

  if (!row) {
    throw notFound('Edição não encontrada.');
  }

  return row.syncRevision;
}

export async function getEditionSyncState(
  db: EditionSyncDb,
  editionId: string,
): Promise<{ editionId: string; syncRevision: number }> {
  const [row] = await db
    .select({
      editionId: schema.editions.id,
      syncRevision: schema.editions.syncRevision,
    })
    .from(schema.editions)
    .where(eq(schema.editions.id, editionId))
    .limit(1);

  if (!row) {
    throw notFound('Edição não encontrada.');
  }

  return row;
}
