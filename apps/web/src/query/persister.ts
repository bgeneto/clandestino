import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { db } from '../db/clandestino-db.js';

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      const row = await db.queryCache.get(key);
      return row?.value ?? null;
    },
    setItem: async (key, value) => {
      await db.queryCache.put({
        key,
        value,
        updatedAt: new Date().toISOString(),
      });
    },
    removeItem: async (key) => {
      await db.queryCache.delete(key);
    },
  },
  key: 'clandestino-query-cache',
  throttleTime: 1000,
});
