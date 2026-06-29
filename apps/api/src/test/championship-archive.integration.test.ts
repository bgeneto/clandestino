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

describe.skipIf(!hasTestDb)('arquivamento de campeonato (integração HTTP)', () => {
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

  it('arquiva um campeonato com sucesso', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato para Arquivar');

    const archived = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    expect(archived.statusCode).toBe(200);
    const body = archived.json<{ id: string; archivedAt: string }>();
    expect(body.id).toBe(championshipId);
    expect(new Date(body.archivedAt).getTime()).toBeGreaterThan(0);

    const get = await app.inject({
      method: 'GET',
      url: `/championships/${championshipId}`,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<{ archivedAt?: string }>().archivedAt).toBe(body.archivedAt);
  });

  it('desarquiva um campeonato com sucesso', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato para Desarquivar');

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    const unarchived = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/unarchive`,
      headers: organizerHeaders(sessionToken),
    });

    expect(unarchived.statusCode).toBe(200);
    const body = unarchived.json<{ id: string; archivedAt: null }>();
    expect(body.id).toBe(championshipId);
    expect(body.archivedAt).toBeNull();

    const get = await app.inject({
      method: 'GET',
      url: `/championships/${championshipId}`,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<{ archivedAt?: string }>().archivedAt).toBeUndefined();
  });

  it('rejeita arquivamento sem autenticação', async () => {
    const championshipId = await createChampionship('Campeonato Sem Auth');

    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejeita desarquivamento sem autenticação', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Sem Auth Desarquivar');

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/unarchive`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('retorna 404 ao arquivar campeonato inexistente', async () => {
    const sessionToken = await loginOrganizer(app);

    const response = await app.inject({
      method: 'POST',
      url: `/championships/${crypto.randomUUID()}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(404);
  });

  it('retorna 409 ao arquivar campeonato já arquivado', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Já Arquivado');

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(409);
  });

  it('retorna 409 ao desarquivar campeonato não arquivado', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Não Arquivado');

    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/unarchive`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(409);
  });

  it('bloqueia criação de edição em campeonato arquivado', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Arquivado Bloqueia Edição');

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(sessionToken),
      payload: {
        championshipId,
        date: '2026-06-29',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('arquivado');
  });

  it('bloqueia importação CSV em campeonato arquivado', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Arquivado Bloqueia CSV');

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/import-scores`,
      headers: {
        ...organizerHeaders(sessionToken),
        'content-type': 'text/csv',
      },
      payload: 'Posição,Nome,Pontuação\n1,Carlos,100',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('arquivado');
  });

  it('permite nova edição após desarquivar', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Desarquivado Libera Edição');

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/unarchive`,
      headers: organizerHeaders(sessionToken),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(sessionToken),
      payload: {
        championshipId,
        date: '2026-06-29',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('lista campeonatos arquivados separadamente', async () => {
    const sessionToken = await loginOrganizer(app);
    const activeId = await createChampionship('Campeonato Ativo');
    const archivedId = await createChampionship('Campeonato Arquivado Lista');

    await app.inject({
      method: 'POST',
      url: `/championships/${archivedId}/archive`,
      headers: organizerHeaders(sessionToken),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/championships',
    });

    expect(response.statusCode).toBe(200);
    const championships = response.json<{
      championships: Array<{ id: string; archivedAt?: string }>;
    }>().championships;
    const active = championships.find((c) => c.id === activeId);
    const archived = championships.find((c) => c.id === archivedId);

    expect(active).toBeDefined();
    expect(active?.archivedAt).toBeUndefined();
    expect(archived).toBeDefined();
    expect(archived?.archivedAt).toBeDefined();
  });
});
