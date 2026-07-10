import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  organizerHeaders,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)('edições recorrentes e renumeração (integração HTTP)', () => {
  let app: FastifyInstance;
  let organizerToken: string;

  beforeAll(async () => {
    await migrateTestDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
    organizerToken = await loginOrganizer(app);
  });

  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  async function org(
    method: 'POST' | 'GET' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>,
  ) {
    return app.inject({
      method,
      url,
      headers: organizerHeaders(organizerToken),
      payload,
    });
  }

  async function createChampionship(name: string): Promise<string> {
    const response = await org('POST', '/championships', { name });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  it('numera edições por data, não por ordem de criação', async () => {
    const championshipId = await createChampionship('Campeonato Ordem');

    const later = await org('POST', '/editions', {
      championshipId,
      date: '2026-08-01',
      autoConfirmMinutes: 15,
    });
    expect(later.statusCode).toBe(201);
    expect(later.json<{ editions: Array<{ name: string }> }>().editions[0]?.name).toBe(
      'Clandestino #1',
    );

    const earlier = await org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      autoConfirmMinutes: 15,
    });
    expect(earlier.statusCode).toBe(201);

    const body = earlier.json<{
      editions: Array<{ name: string; date: string }>;
    }>();
    expect(body.editions[0]?.name).toBe('Clandestino #1');
    expect(body.editions[0]?.date).toBe('2026-07-04');

    const list = await app.inject({
      method: 'GET',
      url: `/championships/${championshipId}/editions`,
    });
    expect(list.headers['cache-control']).toBe('no-store, max-age=0');
    expect(list.headers['cdn-cache-control']).toBe('no-store');
    const editions = list.json<{ editions: Array<{ name: string; date: string }> }>().editions;
    const sortedByDate = [...editions].sort((left, right) => left.date.localeCompare(right.date));
    expect(sortedByDate.map((edition) => edition.name)).toEqual([
      'Clandestino #1',
      'Clandestino #2',
    ]);
    expect(sortedByDate.map((edition) => edition.date)).toEqual(['2026-07-04', '2026-08-01']);
  });

  it('cria até o limite de edições recorrentes semanais', async () => {
    const championshipId = await createChampionship('Campeonato Recorrente');

    const response = await org('POST', '/editions', {
      championshipId,
      date: '2026-12-01',
      recurrence: 'weekly',
      autoConfirmMinutes: 15,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      createdCount: number;
      skippedCount: number;
      editions: Array<{ date: string; name: string }>;
    }>();

    expect(body.createdCount).toBe(4);
    expect(body.skippedCount).toBe(0);
    expect(body.editions.map((edition) => edition.date)).toEqual([
      '2026-12-01',
      '2026-12-08',
      '2026-12-15',
      '2026-12-22',
    ]);
    expect(body.editions.map((edition) => edition.name)).toEqual([
      'Clandestino #1',
      'Clandestino #2',
      'Clandestino #3',
      'Clandestino #4',
    ]);
  });

  it('ignora datas duplicadas em criação recorrente', async () => {
    const championshipId = await createChampionship('Campeonato Duplicatas');

    await org('POST', '/editions', {
      championshipId,
      date: '2026-07-11',
      autoConfirmMinutes: 15,
    });

    const response = await org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      recurrence: 'weekly',
      autoConfirmMinutes: 15,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      createdCount: number;
      skippedCount: number;
      skippedDates: string[];
    }>();

    expect(body.createdCount).toBeGreaterThan(0);
    expect(body.skippedCount).toBe(1);
    expect(body.skippedDates).toEqual(['2026-07-11']);
  });

  it('renumera edições após exclusão', async () => {
    const championshipId = await createChampionship('Campeonato Exclusão');

    const first = await org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      autoConfirmMinutes: 15,
    });
    const second = await org('POST', '/editions', {
      championshipId,
      date: '2026-08-01',
      autoConfirmMinutes: 15,
    });
    const third = await org('POST', '/editions', {
      championshipId,
      date: '2026-09-01',
      autoConfirmMinutes: 15,
    });

    const middleId = second.json<{ editions: Array<{ id: string }> }>().editions[0]?.id;
    expect(middleId).toBeTruthy();

    const deleted = await org('DELETE', `/editions/${middleId}`);
    expect(deleted.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `/championships/${championshipId}/editions`,
    });
    const editions = list.json<{ editions: Array<{ name: string; date: string }> }>().editions;
    expect(editions).toHaveLength(2);
    const sortedByDate = [...editions].sort((left, right) => left.date.localeCompare(right.date));
    expect(sortedByDate.map((edition) => edition.name)).toEqual([
      'Clandestino #1',
      'Clandestino #2',
    ]);
    expect(sortedByDate.map((edition) => edition.date)).toEqual(['2026-07-04', '2026-09-01']);

    void first;
    void third;
  });
});
