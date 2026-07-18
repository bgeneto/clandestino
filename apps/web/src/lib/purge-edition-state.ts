import type { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { db, SESSION_ROW_ID, type ClandestinoDatabase } from '../db/clandestino-db.js';
import { queryClient } from '../query/query-client.js';
import { queryPersister } from '../query/persister.js';
import { QUERY_CACHE_BUSTER, shouldPersistOfflineQuery } from '../query/persistence-policy.js';

function queryKeyIncludesEditionId(queryKey: readonly unknown[], editionId: string): boolean {
  return queryKey.some((part) => part === editionId);
}

async function purgeEditionDexieState(
  editionId: string,
  database: ClandestinoDatabase,
): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.session,
      database.edition,
      database.groups,
      database.participants,
      database.standing,
      database.matches,
      database.outbox,
      database.editionWizardDraft,
    ],
    async () => {
      const session = await database.session.get(SESSION_ROW_ID);
      if (session?.editionId === editionId) {
        await database.session.delete(SESSION_ROW_ID);
      }

      await database.edition.delete(editionId);
      await database.groups.delete(editionId);
      await database.participants.delete(editionId);
      await database.standing.where('editionId').equals(editionId).delete();
      await database.matches.where('editionId').equals(editionId).delete();
      await database.outbox.where('editionId').equals(editionId).delete();
      await database.editionWizardDraft.where('editionId').equals(editionId).delete();
    },
  );
}

async function purgeEditionQueryState(editionId: string, client: QueryClient): Promise<void> {
  client.removeQueries({
    predicate: (query) => queryKeyIncludesEditionId(query.queryKey, editionId),
  });

  await persistQueryClientSave({
    queryClient: client,
    persister: queryPersister,
    buster: QUERY_CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistOfflineQuery,
    },
  });
}

export async function purgeEditionLocalState(
  editionId: string,
  client: QueryClient = queryClient,
  database: ClandestinoDatabase = db,
): Promise<void> {
  await purgeEditionDexieState(editionId, database);
  await purgeEditionQueryState(editionId, client);
}
