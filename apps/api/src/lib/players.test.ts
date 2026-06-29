import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDb,
  createTestApp,
  hasTestDb,
  migrateTestDb,
  truncateAll,
} from '../test/integration-setup.js';
import { findOrCreatePlayerByName } from './players.js';

describe.skipIf(!hasTestDb)('findOrCreatePlayerByName', () => {
  beforeAll(async () => {
    await migrateTestDb();
    await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('returns existing player without creating a duplicate', async () => {
    const app = await createTestApp();
    try {
      const first = await findOrCreatePlayerByName(app.db, 'ANA SOUZA');
      const second = await findOrCreatePlayerByName(app.db, 'ANA SOUZA');

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.player.id).toBe(first.player.id);
    } finally {
      await app.close();
    }
  });

  it('recovers from a concurrent unique insert by re-reading the player', async () => {
    const app = await createTestApp();
    try {
      const results = await Promise.all([
        findOrCreatePlayerByName(app.db, 'RACE PLAYER'),
        findOrCreatePlayerByName(app.db, 'RACE PLAYER'),
      ]);

      expect(results.filter((entry) => entry.created)).toHaveLength(1);
      expect(results[0]?.player.id).toBe(results[1]?.player.id);
    } finally {
      await app.close();
    }
  });
});
