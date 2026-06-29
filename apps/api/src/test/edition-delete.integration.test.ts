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

const FLOW_RULES = {
  ...DEFAULT_TOURNAMENT_RULES,
  minimumGroupSize: 4,
  preferredGroupSize: 4,
  maximumGroupSize: 4,
  protectedSeedCount: 1,
};

describe.skipIf(!hasTestDb)('exclusão de edição (integração HTTP)', () => {
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

  async function createEdition(championshipId: string, date = '2026-08-01'): Promise<string> {
    const response = await org('POST', '/editions', {
      championshipId,
      date,
      autoConfirmMinutes: 15,
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  async function createPlayer(name: string): Promise<string> {
    const response = await org('POST', '/players', { name });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  it('exclui uma edição vazia em rascunho com sucesso', async () => {
    const championshipId = await createChampionship('Campeonato Teste');
    const editionId = await createEdition(championshipId);

    const deleted = await org('DELETE', `/editions/${editionId}`);
    expect(deleted.statusCode).toBe(200);

    const body = deleted.json<{ id: string; championshipId: string; deletedAt: string }>();
    expect(body.id).toBe(editionId);
    expect(body.championshipId).toBe(championshipId);
    expect(new Date(body.deletedAt).getTime()).toBeGreaterThan(0);

    const get = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}`,
    });
    expect(get.statusCode).toBe(404);
  });

  it('rejeita exclusão sem autenticação', async () => {
    const championshipId = await createChampionship('Campeonato Sem Auth');
    const editionId = await createEdition(championshipId);

    const response = await app.inject({
      method: 'DELETE',
      url: `/editions/${editionId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('retorna 404 para edição inexistente', async () => {
    const response = await org('DELETE', '/editions/00000000-0000-4000-8000-000000000001');
    expect(response.statusCode).toBe(404);
  });

  it('rejeita exclusão com jogador inscrito', async () => {
    const championshipId = await createChampionship('Campeonato Com Inscritos');
    const editionId = await createEdition(championshipId);
    const playerId = await createPlayer('Ana Souza');

    const registered = await org('POST', `/editions/${editionId}/registrations`, { playerId });
    expect(registered.statusCode).toBe(201);

    const response = await org('DELETE', `/editions/${editionId}`);
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('jogadores inscritos');
  });

  it('rejeita exclusão após sorteio publicado', async () => {
    const championshipId = await createChampionship('Campeonato Com Sorteio');
    const editionId = await createEdition(championshipId, '2026-07-04');

    const playerIds: string[] = [];
    for (const name of ['Ana', 'Bruno', 'Carla', 'Daniel']) {
      playerIds.push(await createPlayer(name));
    }

    for (const playerId of playerIds) {
      const reg = await org('POST', `/editions/${editionId}/registrations`, { playerId });
      expect(reg.statusCode).toBe(201);
    }

    const draw = await org('POST', `/editions/${editionId}/draw`, {
      randomSeed: 'delete-test-seed',
      rules: FLOW_RULES,
    });
    expect(draw.statusCode).toBe(201);

    const response = await org('DELETE', `/editions/${editionId}`);
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('em andamento ou encerrada');
  });

  it('rejeita exclusão após geração de partidas', async () => {
    const championshipId = await createChampionship('Campeonato Com Partidas');
    const editionId = await createEdition(championshipId, '2026-07-04');

    const playerIds: string[] = [];
    for (const name of ['Ana', 'Bruno', 'Carla', 'Daniel']) {
      playerIds.push(await createPlayer(name));
    }

    for (const playerId of playerIds) {
      const reg = await org('POST', `/editions/${editionId}/registrations`, { playerId });
      expect(reg.statusCode).toBe(201);
    }

    const draw = await org('POST', `/editions/${editionId}/draw`, {
      randomSeed: 'delete-test-seed',
      rules: FLOW_RULES,
    });
    expect(draw.statusCode).toBe(201);

    const generated = await org('POST', `/editions/${editionId}/matches/generate`);
    expect([200, 201]).toContain(generated.statusCode);

    const response = await org('DELETE', `/editions/${editionId}`);
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toMatch(
      /em andamento ou encerrada|jogadores inscritos|partidas/,
    );
  });
});
