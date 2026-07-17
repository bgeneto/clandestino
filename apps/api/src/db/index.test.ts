import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createDb } from './index.js';

describe('createDb.transaction', () => {
  it('serializes concurrent transactions on the same connection', async () => {
    const sqlite = new Database(':memory:');
    const db = createDb(sqlite);

    sqlite.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');

    const order: string[] = [];
    const first = db.transaction(async () => {
      order.push('first-start');
      await Promise.resolve();
      sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('a');
      order.push('first-end');
    });
    const second = db.transaction(async () => {
      order.push('second-start');
      sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('b');
      order.push('second-end');
    });

    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM items').get()).toEqual({ c: 2 });
  });

  it('supports nested transaction via SAVEPOINT without deadlocking', async () => {
    const sqlite = new Database(':memory:');
    const db = createDb(sqlite);

    sqlite.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');

    await db.transaction(async (tx) => {
      sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('outer');
      await tx.transaction(async () => {
        sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('inner');
      });
    });

    const rows = sqlite.prepare('SELECT value FROM items ORDER BY id').all() as Array<{
      value: string;
    }>;
    expect(rows.map((row) => row.value)).toEqual(['outer', 'inner']);
  });

  it('rolls back nested savepoint without aborting the outer transaction', async () => {
    const sqlite = new Database(':memory:');
    const db = createDb(sqlite);

    sqlite.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');

    await db.transaction(async (tx) => {
      sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('keep');
      await expect(
        tx.transaction(async () => {
          sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('drop');
          throw new Error('nested fail');
        }),
      ).rejects.toThrow('nested fail');
      sqlite.prepare('INSERT INTO items (value) VALUES (?)').run('after');
    });

    const rows = sqlite.prepare('SELECT value FROM items ORDER BY id').all() as Array<{
      value: string;
    }>;
    expect(rows.map((row) => row.value)).toEqual(['keep', 'after']);
  });
});
