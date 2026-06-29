import { eq } from 'drizzle-orm';
import { normalizePlayerName, validatePlayerName } from '@clandestino/shared-contracts';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { badRequest, isUniqueViolation } from './errors.js';

type PlayerDb = Pick<Db, 'select' | 'insert'>;

export type FoundPlayer = {
  id: string;
  name: string;
};

async function findPlayerWithNormalizedName(
  db: PlayerDb,
  normalizedName: string,
): Promise<FoundPlayer | null> {
  const [exact] = await db
    .select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players)
    .where(eq(schema.players.name, normalizedName))
    .limit(1);

  if (exact) {
    return exact;
  }

  const rows = await db
    .select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players);

  for (const row of rows) {
    if (normalizePlayerName(row.name) === normalizedName) {
      return row;
    }
  }

  return null;
}

export async function findPlayerByNormalizedName(
  db: PlayerDb,
  rawName: string,
): Promise<FoundPlayer | null> {
  const validation = validatePlayerName(rawName);
  if (!validation.ok) {
    return null;
  }

  return findPlayerWithNormalizedName(db, validation.name);
}

export async function findOrCreatePlayerByName(
  db: PlayerDb,
  playerName: string,
  lineNumber?: number,
): Promise<{ player: FoundPlayer; created: boolean }> {
  const nameValidation = validatePlayerName(playerName);
  if (!nameValidation.ok) {
    throw badRequest(
      lineNumber !== undefined
        ? `Linha ${lineNumber}: ${nameValidation.error}`
        : nameValidation.error,
    );
  }

  const normalized = nameValidation.name;
  const existing = await findPlayerWithNormalizedName(db, normalized);
  if (existing) {
    return { player: existing, created: false };
  }

  try {
    const [created] = await db
      .insert(schema.players)
      .values({ name: normalized })
      .returning({ id: schema.players.id, name: schema.players.name });

    if (!created) {
      throw badRequest(
        lineNumber !== undefined
          ? `Linha ${lineNumber}: não foi possível cadastrar "${normalized}".`
          : `Não foi possível cadastrar "${normalized}".`,
      );
    }

    return { player: created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const recovered = await findPlayerWithNormalizedName(db, normalized);
    if (!recovered) {
      throw error;
    }

    return { player: recovered, created: false };
  }
}
