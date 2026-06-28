import { count, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';

export function formatEditionName(sequenceNumber: number): string {
  return `Clandestino #${sequenceNumber}`;
}

export async function nextEditionNameForChampionship(
  db: Db,
  championshipId: string,
): Promise<string> {
  const [result] = await db
    .select({ total: count() })
    .from(schema.editions)
    .where(eq(schema.editions.championshipId, championshipId));

  return formatEditionName((result?.total ?? 0) + 1);
}
