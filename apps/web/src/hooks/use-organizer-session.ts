import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { db, ORGANIZER_SESSION_ROW_ID, type OrganizerSession } from '../db/clandestino-db.js';
import {
  clearOrganizerSession,
  getOrganizerSession,
  saveOrganizerSession,
} from '../lib/organizer-session.js';

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
  // `getOrganizerSession` resolves to `null` when there is no session, so we
  // can tell "loading" apart from "logged out" and avoid redirect loops.
  const sessionResult = useLiveQuery(async () => getOrganizerSession(), []);
  const isLoading = sessionResult === undefined;
  const session = sessionResult ?? undefined;

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

    if (new Date(current.expiresAt).getTime() <= Date.now()) {
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
