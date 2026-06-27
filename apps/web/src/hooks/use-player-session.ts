import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { db, SESSION_ROW_ID, type PlayerSession } from '../db/clandestino-db.js';
import { clearPlayerSession, savePlayerSession } from '../lib/session.js';

export function usePlayerSession(): {
  session: PlayerSession | undefined;
  isLoggedIn: boolean;
  setSession: (input: {
    playerId: string;
    editionId: string;
    playerName?: string;
  }) => Promise<PlayerSession>;
  clearSession: () => Promise<void>;
} {
  const session = useLiveQuery(() => db.session.get(SESSION_ROW_ID), []);

  const setSession = useCallback(
    async (input: { playerId: string; editionId: string; playerName?: string }) =>
      savePlayerSession(input),
    [],
  );

  const clearSession = useCallback(async () => clearPlayerSession(), []);

  return {
    session,
    isLoggedIn: session !== undefined,
    setSession,
    clearSession,
  };
}
