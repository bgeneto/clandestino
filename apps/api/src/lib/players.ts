import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { badRequest, isUniqueViolation } from './errors.js';

type PlayerDb = Pick<Db, 'select' | 'insert'>;

export type FoundPlayer = {
  id: string;
  name: string;
};

export async function findOrCreatePlayerByName(
  db: PlayerDb,
  playerName: string,
  lineNumber?: number,
): Promise<{ player: FoundPlayer; created: boolean }> {
  let [player] = await db
    .select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players)
    .where(sql`upper(trim(${schema.players.name})) = ${playerName}`)
    .limit(1);

  if (player) {
    return { player, created: false };
  }

  try {
    const [created] = await db
      .insert(schema.players)
      .values({ name: playerName })
      .returning({ id: schema.players.id, name: schema.players.name });

    if (!created) {
      throw badRequest(
        lineNumber !== undefined
          ? `Linha ${lineNumber}: não foi possível cadastrar "${playerName}".`
          : `Não foi possível cadastrar "${playerName}".`,
      );
    }

    return { player: created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    [player] = await db
      .select({ id: schema.players.id, name: schema.players.name })
      .from(schema.players)
      .where(sql`upper(trim(${schema.players.name})) = ${playerName}`)
      .limit(1);

    if (!player) {
      throw error;
    }

    return { player, created: false };
  }
}
