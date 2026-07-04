import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { normalizePlayerName, validatePlayerName } from '@clandestino/shared-contracts';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { badRequest, conflict, isUniqueViolation, notFound } from './errors.js';

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

export async function updatePlayerName(
  db: Db,
  playerId: string,
  rawName: string,
): Promise<FoundPlayer & { createdAt: Date }> {
  const nameValidation = validatePlayerName(rawName);
  if (!nameValidation.ok) {
    throw badRequest(nameValidation.error);
  }

  const canonical = nameValidation.name;
  const key = normalizePlayerName(canonical);

  const [existing] = await db
    .select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
    .limit(1);

  if (!existing) {
    throw notFound('Jogador não encontrado.');
  }

  const currentKey = normalizePlayerName(existing.name);
  if (key !== currentKey) {
    const duplicate = await findPlayerWithNormalizedKey(db, key);
    if (duplicate) {
      throw conflict('Já existe um jogador com este nome.');
    }
  }

  try {
    const [updated] = await db
      .update(schema.players)
      .set({ name: canonical })
      .where(eq(schema.players.id, playerId))
      .returning({
        id: schema.players.id,
        name: schema.players.name,
        createdAt: schema.players.createdAt,
      });

    if (!updated) {
      throw notFound('Jogador não encontrado.');
    }

    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('Já existe um jogador com este nome.');
    }
    throw error;
  }
}

const UNSORTED_EDITION_STATUSES = ['RASCUNHO', 'INSCRICOES_ABERTAS'] as const;

type PlayerParticipationReason =
  'pontuacao' | 'partida' | 'grupo' | 'classificacao' | 'colocacao' | 'sorteio' | 'inscricao';

export type PlayerParticipationCheck = {
  canDelete: boolean;
  reasons: PlayerParticipationReason[];
  draftEditionIds: string[];
  zeroPointsChampionshipIds: string[];
};

export async function checkPlayerCanBeDeleted(
  db: Db,
  playerId: string,
): Promise<PlayerParticipationCheck> {
  const [
    pointsWithValue,
    zeroPointsRows,
    groupPlayersCount,
    matchParticipantsCount,
    standingsCount,
    finalPlacementsCount,
    drawSnapshotsCount,
    matchPlayersCount,
    unsortedRegistrations,
    sortedRegistrations,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.championshipPlayerPoints)
      .where(
        and(
          eq(schema.championshipPlayerPoints.playerId, playerId),
          sql`${schema.championshipPlayerPoints.accumulatedPoints} > 0`,
        ),
      ),
    db
      .select({ championshipId: schema.championshipPlayerPoints.championshipId })
      .from(schema.championshipPlayerPoints)
      .where(
        and(
          eq(schema.championshipPlayerPoints.playerId, playerId),
          eq(schema.championshipPlayerPoints.accumulatedPoints, 0),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.groupPlayers)
      .where(eq(schema.groupPlayers.playerId, playerId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.matchParticipants)
      .where(eq(schema.matchParticipants.playerId, playerId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.standings)
      .where(eq(schema.standings.playerId, playerId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.finalPlacements)
      .where(eq(schema.finalPlacements.playerId, playerId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.drawSnapshots)
      .where(eq(schema.drawSnapshots.playerId, playerId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.matches)
      .where(
        or(
          eq(schema.matches.playerOneId, playerId),
          eq(schema.matches.playerTwoId, playerId),
          eq(schema.matches.walkoverAbsentPlayerId, playerId),
        ),
      ),
    db
      .select({ editionId: schema.editionRegistrations.editionId })
      .from(schema.editionRegistrations)
      .innerJoin(schema.editions, eq(schema.editionRegistrations.editionId, schema.editions.id))
      .where(
        and(
          eq(schema.editionRegistrations.playerId, playerId),
          inArray(schema.editions.status, [...UNSORTED_EDITION_STATUSES]),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.editionRegistrations)
      .innerJoin(schema.editions, eq(schema.editionRegistrations.editionId, schema.editions.id))
      .where(
        and(
          eq(schema.editionRegistrations.playerId, playerId),
          notInArray(schema.editions.status, [...UNSORTED_EDITION_STATUSES]),
        ),
      ),
  ]);

  const reasons: PlayerParticipationReason[] = [];

  if ((pointsWithValue[0]?.count ?? 0) > 0) reasons.push('pontuacao');
  if ((groupPlayersCount[0]?.count ?? 0) > 0) reasons.push('grupo');
  if ((matchParticipantsCount[0]?.count ?? 0) > 0) reasons.push('partida');
  if ((standingsCount[0]?.count ?? 0) > 0) reasons.push('classificacao');
  if ((finalPlacementsCount[0]?.count ?? 0) > 0) reasons.push('colocacao');
  if ((drawSnapshotsCount[0]?.count ?? 0) > 0) reasons.push('sorteio');
  if ((matchPlayersCount[0]?.count ?? 0) > 0) reasons.push('partida');
  if ((sortedRegistrations[0]?.count ?? 0) > 0) reasons.push('inscricao');

  const canDelete = reasons.length === 0;
  const draftEditionIds = unsortedRegistrations.map((row) => row.editionId);
  const zeroPointsChampionshipIds = zeroPointsRows.map((row) => row.championshipId);

  return { canDelete, reasons, draftEditionIds, zeroPointsChampionshipIds };
}

export async function deletePlayer(
  db: Db,
  playerId: string,
): Promise<{ id: string; deletedAt: string }> {
  const [player] = await db
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
    .limit(1);

  if (!player) {
    throw notFound('Jogador não encontrado.');
  }

  const check = await checkPlayerCanBeDeleted(db, playerId);

  if (!check.canDelete) {
    const reasonMessages: Record<PlayerParticipationReason, string> = {
      pontuacao: 'pontuação acumulada',
      partida: 'partidas registradas',
      grupo: 'grupos sorteados',
      classificacao: 'classificação publicada',
      colocacao: 'colocação final',
      sorteio: 'sorteio publicado',
      inscricao: 'inscrição em edição já sorteada ou em andamento',
    };
    const detail = [...new Set(check.reasons)].map((reason) => reasonMessages[reason]).join(', ');
    throw conflict(`Não é possível remover este jogador porque possui ${detail}.`);
  }

  await db.transaction(async (tx) => {
    if (check.draftEditionIds.length > 0) {
      await tx
        .delete(schema.editionRegistrations)
        .where(
          and(
            eq(schema.editionRegistrations.playerId, playerId),
            inArray(schema.editionRegistrations.editionId, check.draftEditionIds),
          ),
        );
    }

    if (check.zeroPointsChampionshipIds.length > 0) {
      await tx
        .delete(schema.championshipPlayerPoints)
        .where(
          and(
            eq(schema.championshipPlayerPoints.playerId, playerId),
            inArray(
              schema.championshipPlayerPoints.championshipId,
              check.zeroPointsChampionshipIds,
            ),
          ),
        );
    }

    await tx.delete(schema.players).where(eq(schema.players.id, playerId));
  });

  return { id: playerId, deletedAt: new Date().toISOString() };
}
