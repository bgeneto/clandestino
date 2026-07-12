import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect } from 'react';
import { db, ORGANIZER_SESSION_ROW_ID, type OrganizerSession } from '../db/clandestino-db.js';
import { clearOrganizerSession, saveOrganizerSession } from '../lib/organizer-session.js';

function isOrganizerSessionExpired(session: OrganizerSession): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

export function useOrganizerSession(): {
  session: OrganizerSession | undefined;
  isLoading: boolean;
  isLoggedIn: boolean;
  setSession: (input: {
    sessionToken: string;
    email: string;
    expiresAt: string;
  }) => Promise<OrganizerSession>;
  clearSession: () => Promise<void>;
  refreshSession: () => Promise<OrganizerSession | undefined>;
} {
  // `useLiveQuery` returns `undefined` while the IndexedDB read is in flight.
  // Resolving a missing/expired row to `null` distinguishes "loading" from
  // "logged out" and avoids redirect loops. Queriers must stay read-only —
  // Dexie throws ReadOnlyError if we delete expired sessions here.
  const sessionResult = useLiveQuery(async () => {
    const current = await db.organizerSession.get(ORGANIZER_SESSION_ROW_ID);
    if (!current || isOrganizerSessionExpired(current)) {
      return null;
    }
    return current;
  }, []);
  const isLoading = sessionResult === undefined;
  const session = sessionResult ?? undefined;

  useEffect(() => {
    void (async () => {
      const current = await db.organizerSession.get(ORGANIZER_SESSION_ROW_ID);
      if (current && isOrganizerSessionExpired(current)) {
        await clearOrganizerSession();
      }
    })();
  }, [sessionResult]);

  const setSession = useCallback(
    async (input: { sessionToken: string; email: string; expiresAt: string }) =>
      saveOrganizerSession(input),
    [],
  );

  const clearSession = useCallback(async () => clearOrganizerSession(), []);

  const refreshSession = useCallback(async () => {
    const current = await db.organizerSession.get(ORGANIZER_SESSION_ROW_ID);
    if (!current) {
      return undefined;
    }

    if (isOrganizerSessionExpired(current)) {
      await clearOrganizerSession();
      return undefined;
    }

    return current;
  }, []);

  return {
    session,
    isLoading,
    isLoggedIn: Boolean(sessionResult),
    setSession,
    clearSession,
    refreshSession,
  };
}
