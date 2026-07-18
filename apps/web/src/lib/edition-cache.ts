import type {
  Edition,
  EditionGroupsResponse,
  EditionParticipantsResponse,
  EditionStandingsResponse,
  Match,
} from '@clandestino/shared-contracts';
import { db } from '../db/clandestino-db.js';

export async function cacheEdition(edition: Edition): Promise<void> {
  const existing = await db.edition.get(edition.id);
  await db.edition.put({
    id: edition.id,
    edition,
    cachedAt: new Date().toISOString(),
    matchesComplete: existing?.matchesComplete ?? false,
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
  await db.transaction('rw', db.matches, db.edition, async () => {
    await db.matches.where('editionId').equals(editionId).delete();
    await db.matches.bulkPut(
      matches.map((match) => ({
        id: match.id,
        editionId,
        match,
        cachedAt,
      })),
    );

    const existing = await db.edition.get(editionId);
    if (existing) {
      await db.edition.put({
        ...existing,
        matchesComplete: true,
        cachedAt,
      });
    }
  });
}

/** Upsert sem marcar a lista completa — "minhas partidas" não satisfaz fallback público. */
export async function upsertCachedMatches(editionId: string, matches: Match[]): Promise<void> {
  const cachedAt = new Date().toISOString();
  await db.matches.bulkPut(
    matches.map((match) => ({
      id: match.id,
      editionId,
      match,
      cachedAt,
    })),
  );
}

export async function getCachedMatches(editionId: string): Promise<Match[]> {
  const rows = await db.matches.where('editionId').equals(editionId).toArray();
  return rows.map((row) => row.match);
}

export async function isEditionMatchesCacheComplete(editionId: string): Promise<boolean> {
  const row = await db.edition.get(editionId);
  return row?.matchesComplete === true;
}

export async function getCachedMatchesForPlayer(
  editionId: string,
  playerId: string,
): Promise<Match[]> {
  const matches = await getCachedMatches(editionId);
  return matches.filter((match) =>
    match.participants.some((participant) => participant.playerId === playerId),
  );
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

export async function cacheParticipants(
  editionId: string,
  response: EditionParticipantsResponse,
): Promise<void> {
  await db.participants.put({
    id: editionId,
    editionId,
    participants: response.participants,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedParticipants(
  editionId: string,
): Promise<EditionParticipantsResponse | undefined> {
  const row = await db.participants.get(editionId);
  if (!row) {
    return undefined;
  }

  return { participants: row.participants };
}
