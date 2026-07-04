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

describe.skipIf(!hasTestDb)('gerenciamento de jogadores (integração HTTP)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await migrateTestDb();
    app = await createTestApp({ ORGANIZER_ALLOWED_EMAILS: 'organizador@gmail.com' });
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

  async function createEdition(championshipId: string, date = '2026-08-01'): Promise<string> {
    const sessionToken = await loginOrganizer(app);
    const response = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(sessionToken),
      payload: { championshipId, date, autoConfirmMinutes: 15 },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ editions: Array<{ id: string }> }>().editions[0]!.id;
  }

  async function createPlayer(name: string): Promise<string> {
    const sessionToken = await loginOrganizer(app);
    const response = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(sessionToken),
      payload: { name },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  async function registerPlayer(editionId: string, playerId: string): Promise<void> {
    const sessionToken = await loginOrganizer(app);
    const response = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/registrations`,
      headers: organizerHeaders(sessionToken),
      payload: { playerId },
    });
    expect(response.statusCode).toBe(201);
  }

  it('atualiza o nome de um jogador', async () => {
    const sessionToken = await loginOrganizer(app);
    const playerId = await createPlayer('Ana Souza');

    const response = await app.inject({
      method: 'PATCH',
      url: `/players/${playerId}`,
      headers: organizerHeaders(sessionToken),
      payload: { name: 'Ana Silva' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ id: string; name: string }>();
    expect(body.id).toBe(playerId);
    expect(body.name).toBe('ANA SILVA');
  });

  it('rejeita atualização para nome duplicado', async () => {
    const sessionToken = await loginOrganizer(app);
    const playerOne = await createPlayer('Ana Souza');
    await createPlayer('Bruno Lima');

    const response = await app.inject({
      method: 'PATCH',
      url: `/players/${playerOne}`,
      headers: organizerHeaders(sessionToken),
      payload: { name: 'Bruno Lima' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('Já existe');
  });

  it('rejeita atualização com nome inválido', async () => {
    const sessionToken = await loginOrganizer(app);
    const playerId = await createPlayer('Ana Souza');

    const response = await app.inject({
      method: 'PATCH',
      url: `/players/${playerId}`,
      headers: organizerHeaders(sessionToken),
      payload: { name: 'A' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejeita atualização de jogador inexistente', async () => {
    const sessionToken = await loginOrganizer(app);
    const response = await app.inject({
      method: 'PATCH',
      url: `/players/${crypto.randomUUID()}`,
      headers: organizerHeaders(sessionToken),
      payload: { name: 'Novo Nome' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('remove um jogador sem participação', async () => {
    const sessionToken = await loginOrganizer(app);
    const playerId = await createPlayer('Ana Souza');

    const response = await app.inject({
      method: 'DELETE',
      url: `/players/${playerId}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ id: string; deletedAt: string }>();
    expect(body.id).toBe(playerId);
    expect(new Date(body.deletedAt).getTime()).toBeGreaterThan(0);

    const list = await app.inject({
      method: 'GET',
      url: '/players',
    });
    expect(list.statusCode).toBe(200);
    const players = list.json<{ players: Array<{ id: string }> }>().players;
    expect(players.some((player) => player.id === playerId)).toBe(false);
  });

  it('remove jogador inscrito em edição rascunho e apaga a inscrição', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Teste');
    const editionId = await createEdition(championshipId);
    const playerId = await createPlayer('Ana Souza');
    await registerPlayer(editionId, playerId);

    const response = await app.inject({
      method: 'DELETE',
      url: `/players/${playerId}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(200);

    const registrations = await adminQuery(
      'SELECT * FROM edition_registration WHERE player_id = ?',
      [playerId],
    );
    expect(registrations).toHaveLength(0);
  });

  it('rejeita remoção de jogador com pontuação importada', async () => {
    const sessionToken = await loginOrganizer(app);
    const championshipId = await createChampionship('Campeonato Com Pontuação');
    const playerId = await createPlayer('Ana Pontuada');

    await adminQuery(
      'INSERT INTO championship_player_points (championship_id, player_id, accumulated_points, updated_at) VALUES (?, ?, ?, ?)',
      [championshipId, playerId, 100, Date.now()],
    );

    const response = await app.inject({
      method: 'DELETE',
      url: `/players/${playerId}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('pontuação');
  });

  it('rejeita remoção sem autenticação', async () => {
    const playerId = await createPlayer('Ana Souza');

    const response = await app.inject({
      method: 'DELETE',
      url: `/players/${playerId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('retorna 404 para jogador inexistente', async () => {
    const sessionToken = await loginOrganizer(app);
    const response = await app.inject({
      method: 'DELETE',
      url: `/players/${crypto.randomUUID()}`,
      headers: organizerHeaders(sessionToken),
    });

    expect(response.statusCode).toBe(404);
  });
});
