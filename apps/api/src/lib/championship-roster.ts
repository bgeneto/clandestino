import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';

type DbExecutor = Pick<Db, 'select' | 'insert'>;

export type ChampionshipRosterRow = {
  playerId: string;
  playerName: string;
  accumulatedPoints: number;
};

export async function listChampionshipRoster(
  db: DbExecutor,
  championshipId: string,
): Promise<ChampionshipRosterRow[]> {
  const [pointsRows, registrationRows] = await Promise.all([
    db
      .select({
        playerId: schema.championshipPlayerPoints.playerId,
        accumulatedPoints: schema.championshipPlayerPoints.accumulatedPoints,
      })
      .from(schema.championshipPlayerPoints)
      .where(eq(schema.championshipPlayerPoints.championshipId, championshipId)),
    db
      .select({ playerId: schema.editionRegistrations.playerId })
      .from(schema.editionRegistrations)
      .innerJoin(schema.editions, eq(schema.editionRegistrations.editionId, schema.editions.id))
      .where(eq(schema.editions.championshipId, championshipId)),
  ]);

  const playerIds = new Set<string>();
  const pointsByPlayerId = new Map<string, number>();

  for (const row of pointsRows) {
    playerIds.add(row.playerId);
    pointsByPlayerId.set(row.playerId, row.accumulatedPoints);
  }

  for (const row of registrationRows) {
    playerIds.add(row.playerId);
  }

  if (playerIds.size === 0) {
    return [];
  }

  const players = await db
    .select({
      id: schema.players.id,
      name: schema.players.name,
    })
    .from(schema.players)
    .where(inArray(schema.players.id, [...playerIds]))
    .orderBy(asc(schema.players.name));

  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    accumulatedPoints: pointsByPlayerId.get(player.id) ?? 0,
  }));
}

export async function ensureChampionshipPlayer(
  db: DbExecutor,
  championshipId: string,
  playerId: string,
): Promise<void> {
  const [existing] = await db
    .select({ playerId: schema.championshipPlayerPoints.playerId })
    .from(schema.championshipPlayerPoints)
    .where(
      and(
        eq(schema.championshipPlayerPoints.championshipId, championshipId),
        eq(schema.championshipPlayerPoints.playerId, playerId),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(schema.championshipPlayerPoints).values({
    championshipId,
    playerId,
    accumulatedPoints: 0,
  });
}
