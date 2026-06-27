import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { db, SESSION_ROW_ID, type PlayerSession } from '../db/clandestino-db.js';
import { clearPlayerSession, savePlayerSession } from '../lib/session.js';

export function usePlayerSession(): {
  session: PlayerSession | undefined;
  isLoading: boolean;
  isLoggedIn: boolean;
  setSession: (input: {
    playerId: string;
    editionId: string;
    playerName?: string;
  }) => Promise<PlayerSession>;
  clearSession: () => Promise<void>;
} {
  // `useLiveQuery` returns `undefined` while loading; mapping a missing row to
  // `null` lets us distinguish "loading" from "logged out" to avoid redirect loops.
  const sessionResult = useLiveQuery(
    async () => (await db.session.get(SESSION_ROW_ID)) ?? null,
    [],
  );
  const isLoading = sessionResult === undefined;
  const session = sessionResult ?? undefined;

  const setSession = useCallback(
    async (input: { playerId: string; editionId: string; playerName?: string }) =>
      savePlayerSession(input),
    [],
  );

  const clearSession = useCallback(async () => clearPlayerSession(), []);

  return {
    session,
    isLoading,
    isLoggedIn: Boolean(sessionResult),
    setSession,
    clearSession,
  };
}
