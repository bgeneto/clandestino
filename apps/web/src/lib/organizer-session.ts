import { db, ORGANIZER_SESSION_ROW_ID, type OrganizerSession } from '../db/clandestino-db.js';

export async function getOrganizerSession(): Promise<OrganizerSession | undefined> {
  const session = await db.organizerSession.get(ORGANIZER_SESSION_ROW_ID);
  if (!session) {
    return undefined;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await clearOrganizerSession();
    return undefined;
  }

  return session;
}

export async function saveOrganizerSession(input: {
  sessionToken: string;
  email: string;
  expiresAt: string;
}): Promise<OrganizerSession> {
  const session: OrganizerSession = {
    id: ORGANIZER_SESSION_ROW_ID,
    sessionToken: input.sessionToken,
    email: input.email,
    expiresAt: input.expiresAt,
    updatedAt: new Date().toISOString(),
  };

  await db.organizerSession.put(session);
  return session;
}

export async function clearOrganizerSession(): Promise<void> {
  await db.organizerSession.delete(ORGANIZER_SESSION_ROW_ID);
}

export async function hasOrganizerSession(): Promise<boolean> {
  const session = await getOrganizerSession();
  return session !== undefined;
}
