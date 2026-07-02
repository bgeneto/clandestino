import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { formatEditionName } from '@clandestino/shared-contracts';

export { formatEditionName };

type DbExecutor = Pick<Db, 'select' | 'update'>;

const PENDING_NAME_PREFIX = '__pending__';

export function pendingEditionName(editionId: string): string {
  return `${PENDING_NAME_PREFIX}${editionId}`;
}

export function isPendingEditionName(name: string): boolean {
  return name.startsWith(PENDING_NAME_PREFIX);
}

export async function renumberEditionNamesForChampionship(
  db: DbExecutor,
  championshipId: string,
): Promise<void> {
  const editions = await db
    .select({
      id: schema.editions.id,
      date: schema.editions.date,
      createdAt: schema.editions.createdAt,
      name: schema.editions.name,
    })
    .from(schema.editions)
    .where(eq(schema.editions.championshipId, championshipId))
    .orderBy(asc(schema.editions.date), asc(schema.editions.createdAt));

  const targets = editions.map((edition, index) => ({
    id: edition.id,
    name: formatEditionName(index + 1),
    currentName: edition.name,
  }));

  const toUpdate = targets.filter((target) => target.currentName !== target.name);
  if (toUpdate.length === 0) {
    return;
  }

  for (const target of toUpdate) {
    await db
      .update(schema.editions)
      .set({ name: `__tmp__${target.id}` })
      .where(eq(schema.editions.id, target.id));
  }

  for (const target of toUpdate) {
    await db
      .update(schema.editions)
      .set({ name: target.name })
      .where(eq(schema.editions.id, target.id));
  }
}

export async function fetchExistingEditionDates(
  db: Pick<Db, 'select'>,
  championshipId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ date: schema.editions.date })
    .from(schema.editions)
    .where(eq(schema.editions.championshipId, championshipId));

  return new Set(rows.map((row) => row.date));
}
