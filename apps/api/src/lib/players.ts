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

/**
 * Localiza um jogador cuja forma canônica, passada pela chave de
 * comparação `normalizePlayerName` (sem acentos/cedilha/tilde, caixa alta),
 * é igual ao argumento `normalizedKey`.
 *
 * O índice único `player_name_unique` é case-sensitive binário, então não
 * cobre sozinho casos como `JOSE` vs `JOSÉ`. Por isso a busca sempre
 * combina:
 *  1. `eq(schema.players.name, normalizedKey)` — bate no caso comum
 *     (mesma grafia, já em maiúsculas);
 *  2. fallback em memória aplicando `normalizePlayerName` a cada linha,
 *     cobrindo `JOSÉ` (com acento) quando se busca por `JOSE` (sem acento)
 *     e vice-versa.
 *
 * O **nome armazenado** na coluna preserva a grafia original (acentos,
 * cedilha); a comparação é que é feita sem eles.
 */
async function findPlayerWithNormalizedKey(
  db: PlayerDb,
  normalizedKey: string,
): Promise<FoundPlayer | null> {
  const [exact] = await db
    .select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players)
    .where(eq(schema.players.name, normalizedKey))
    .limit(1);

  if (exact) {
    return exact;
  }

  const rows = await db
    .select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players);

  for (const row of rows) {
    if (normalizePlayerName(row.name) === normalizedKey) {
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

  return findPlayerWithNormalizedKey(db, normalizePlayerName(validation.name));
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

  // O nome persistido preserva a grafia original (JOSÉ, FÁTIMA, CONCEIÇÃO).
  const canonical = nameValidation.name;
  // A chave de comparação é sem acentos, cedilha ou til.
  const key = normalizePlayerName(canonical);

  const existing = await findPlayerWithNormalizedKey(db, key);
  if (existing) {
    return { player: existing, created: false };
  }

  try {
    const [created] = await db
      .insert(schema.players)
      .values({ name: canonical })
      .returning({ id: schema.players.id, name: schema.players.name });

    if (!created) {
      throw badRequest(
        lineNumber !== undefined
          ? `Linha ${lineNumber}: não foi possível cadastrar "${canonical}".`
          : `Não foi possível cadastrar "${canonical}".`,
      );
    }

    return { player: created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const recovered = await findPlayerWithNormalizedKey(db, key);
    if (!recovered) {
      throw error;
    }

    return { player: recovered, created: false };
  }
}
