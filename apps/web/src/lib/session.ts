import { db, SESSION_ROW_ID, type PlayerSession } from '../db/clandestino-db.js';

export async function getPlayerSession(): Promise<PlayerSession | undefined> {
  return db.session.get(SESSION_ROW_ID);
}

export async function savePlayerSession(input: {
  playerId: string;
  editionId: string;
  playerName?: string;
}): Promise<PlayerSession> {
  const session: PlayerSession = {
    id: SESSION_ROW_ID,
    playerId: input.playerId,
    editionId: input.editionId,
    playerName: input.playerName,
    updatedAt: new Date().toISOString(),
  };

  await db.session.put(session);
  return session;
}

export async function clearPlayerSession(): Promise<void> {
  await db.session.delete(SESSION_ROW_ID);
}

export async function hasPlayerSession(): Promise<boolean> {
  const session = await getPlayerSession();
  return session !== undefined;
}
