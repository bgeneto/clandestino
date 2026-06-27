import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/clandestino-db.js';

export function useOutboxCount(): number {
  const count = useLiveQuery(
    () => db.outbox.where('status').equals('AGUARDANDO_SINCRONIZACAO').count(),
    [],
    0,
  );

  return count ?? 0;
}
