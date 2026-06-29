import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  adminQuery,
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  organizerHeaders,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)('exclusão de campeonato (integração HTTP)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await migrateTestDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  async function createChampionship(name: string): Promise<string> {
    const sessionToken = await loginOrganizer(app);
    const response = await app.inject({
      method: 'POST',
      url: '/championships',
      headers: organizerHeaders(sessionToken),
      payload: { name },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  it('exclui um campeonato vazio com sucesso', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Vazio');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/championships/${championshipId}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(deleted.statusCode).toBe(200);
    const body = deleted.json<{ id: string; deletedAt: string }>();
    expect(body.id).toBe(championshipId);
    expect(new Date(body.deletedAt).getTime()).toBeGreaterThan(0);

    const get = await app.inject({
      method: 'GET',
      url: `/championships/${championshipId}`,
    });
    expect(get.statusCode).toBe(404);
  });

  it('rejeita exclusão sem autenticação', async () => {
    const championshipId = await createChampionship('Campeonato Sem Auth');

    const response = await app.inject({
      method: 'DELETE',
      url: `/championships/${championshipId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('retorna 404 para campeonato inexistente', async () => {
    const sessionToken = await loginOrganizer(app);

    const response = await app.inject({
      method: 'DELETE',
      url: `/championships/${crypto.randomUUID()}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejeita exclusão quando o campeonato possui edições', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Com Edição');

    await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(sessionToken),
      payload: {
        championshipId,
        date: '2026-06-29',
      },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/championships/${championshipId}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('edições');
  });

  it('rejeita exclusão quando o campeonato possui pontuações importadas', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Com Pontuação');

    const player = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(sessionToken),
      payload: { name: 'Jogador Pontuado' },
    });
    const playerId = player.json<{ id: string }>().id;

    await adminQuery(
      'INSERT INTO championship_player_points (championship_id, player_id, accumulated_points, updated_at) VALUES (?, ?, ?, ?)',
      [championshipId, playerId, 100, Date.now()],
    );

    const response = await app.inject({
      method: 'DELETE',
      url: `/championships/${championshipId}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('pontuações');
  });
});
