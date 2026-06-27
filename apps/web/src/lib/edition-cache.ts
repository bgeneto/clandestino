import type {
  Edition,
  EditionGroupsResponse,
  EditionStandingsResponse,
  Match,
} from '@clandestino/shared-contracts';
import { db } from '../db/clandestino-db.js';

export async function cacheEdition(edition: Edition): Promise<void> {
  await db.edition.put({
    id: edition.id,
    edition,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedEdition(editionId: string): Promise<Edition | undefined> {
  const row = await db.edition.get(editionId);
  return row?.edition;
}

export async function cacheGroups(editionId: string, groups: EditionGroupsResponse): Promise<void> {
  await db.groups.put({
    id: editionId,
    editionId,
    groups,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedGroups(
  editionId: string,
): Promise<EditionGroupsResponse | undefined> {
  const row = await db.groups.get(editionId);
  return row?.groups;
}

export async function cacheMatches(editionId: string, matches: Match[]): Promise<void> {
  const cachedAt = new Date().toISOString();
  await db.transaction('rw', db.matches, async () => {
    await db.matches.where('editionId').equals(editionId).delete();
    await db.matches.bulkPut(
      matches.map((match) => ({
        id: match.id,
        editionId,
        match,
        cachedAt,
      })),
    );
  });
}

export async function getCachedMatches(editionId: string): Promise<Match[]> {
  const rows = await db.matches.where('editionId').equals(editionId).toArray();
  return rows.map((row) => row.match);
}

export async function cacheStandings(
  editionId: string,
  standings: EditionStandingsResponse,
): Promise<void> {
  const cachedAt = new Date().toISOString();
  await db.transaction('rw', db.standing, async () => {
    await db.standing.where('editionId').equals(editionId).delete();
    await db.standing.bulkPut(
      standings.groups.map((group) => ({
        id: `${editionId}:${group.groupId}`,
        editionId,
        groupId: group.groupId,
        standings,
        cachedAt,
      })),
    );
  });
}

export async function getCachedStandings(
  editionId: string,
): Promise<EditionStandingsResponse | undefined> {
  const rows = await db.standing.where('editionId').equals(editionId).toArray();
  if (rows.length === 0) {
    return undefined;
  }

  return rows[0]?.standings;
}
