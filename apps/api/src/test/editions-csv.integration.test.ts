import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  adminQuery,
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  getCreatedEditionId,
  organizerHeaders,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)('jogadores, campeonatos e importação CSV (integração HTTP)', () => {
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

  async function createChampionship(name: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/championships',
      headers: organizerHeaders(organizerToken),
      payload: { name },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  async function createPlayer(name: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(organizerToken),
      payload: { name },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  it('exige autenticação de organizador para criar jogador', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/players',
      payload: { name: 'Sem Sessão' },
    });
    expect(unauth.statusCode).toBe(401);
  });

  it('normaliza nome do jogador para maiúsculas ao cadastrar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(organizerToken),
      payload: { name: '  ana souza  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ name: string }>().name).toBe('ANA SOUZA');
  });

  it('rejeita cadastro de jogador com nome curto (400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(organizerToken),
      payload: { name: '  a  ' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toContain('ao menos 2 caracteres');
  });

  it('rejeita cadastro duplicado de jogador (409)', async () => {
    await createPlayer('Ana Souza');

    const response = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(organizerToken),
      payload: { name: 'ana souza' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error.toLowerCase()).toContain(
      'já existe um jogador',
    );
  });

  it('rejeita cadastro com nome equivalente após normalização de espaços (409)', async () => {
    await createPlayer('Ana Souza');

    const response = await app.inject({
      method: 'POST',
      url: '/players',
      headers: organizerHeaders(organizerToken),
      payload: { name: '  ana   souza  ' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error.toLowerCase()).toContain(
      'já existe um jogador',
    );
  });

  it('rejeita criação duplicada de campeonato (409)', async () => {
    await createChampionship('Campeonato Duplicado');

    const response = await app.inject({
      method: 'POST',
      url: '/championships',
      headers: organizerHeaders(organizerToken),
      payload: { name: 'Campeonato Duplicado' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error.toLowerCase()).toContain(
      'já existe um campeonato',
    );
  });

  it('rejeita inscrição duplicada na edição (409)', async () => {
    const championshipId = await createChampionship('Campeonato Inscrição');
    const editionResponse = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: { championshipId, date: '2026-08-01' },
    });
    expect(editionResponse.statusCode).toBe(201);
    const editionId = getCreatedEditionId(editionResponse.json());
    const playerId = await createPlayer('Inscrito');

    const first = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/registrations`,
      headers: organizerHeaders(organizerToken),
      payload: { playerId },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/registrations`,
      headers: organizerHeaders(organizerToken),
      payload: { playerId },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json<{ error: string }>().error).toContain('já inscrito');
  });

  it('permite desinscrever jogador enquanto inscrições estão abertas', async () => {
    const championshipId = await createChampionship('Campeonato Desinscrição');
    const editionResponse = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: { championshipId, date: '2026-08-01' },
    });
    expect(editionResponse.statusCode).toBe(201);
    const editionId = getCreatedEditionId(editionResponse.json());
    const playerId = await createPlayer('Desinscrever');

    const register = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/registrations`,
      headers: organizerHeaders(organizerToken),
      payload: { playerId },
    });
    expect(register.statusCode).toBe(201);

    const unregister = await app.inject({
      method: 'DELETE',
      url: `/editions/${editionId}/registrations/${playerId}`,
      headers: organizerHeaders(organizerToken),
    });
    expect(unregister.statusCode).toBe(200);
    expect(unregister.json<{ registrations: unknown[] }>().registrations).toHaveLength(0);

    const list = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/registrations`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ registrations: unknown[] }>().registrations).toHaveLength(0);
  });

  it('lista elenco do campeonato sem jogadores de outros campeonatos', async () => {
    const championshipA = await createChampionship('Campeonato A');
    const championshipB = await createChampionship('Campeonato B');
    await createPlayer('JOGA SÓ NO B');

    const csvA = 'player_name,accumulated_points\nJOGADOR A,100\nJOGADOR B,200\n';
    const importA = await app.inject({
      method: 'POST',
      url: `/championships/${championshipA}/import-scores`,
      headers: {
        ...organizerHeaders(organizerToken),
        'content-type': 'text/csv',
      },
      payload: csvA,
    });
    expect(importA.statusCode).toBe(200);

    const rosterA = await app.inject({
      method: 'GET',
      url: `/championships/${championshipA}/roster`,
    });
    expect(rosterA.statusCode).toBe(200);
    const rosterNames = rosterA
      .json<{ roster: Array<{ playerName: string }> }>()
      .roster.map((entry) => entry.playerName);
    expect(rosterNames).toEqual(['JOGADOR A', 'JOGADOR B']);
    expect(rosterNames).not.toContain('JOGA SÓ NO B');

    const rosterB = await app.inject({
      method: 'GET',
      url: `/championships/${championshipB}/roster`,
    });
    expect(rosterB.statusCode).toBe(200);
    expect(rosterB.json<{ roster: unknown[] }>().roster).toHaveLength(0);
  });

  it('inscrição na edição vincula jogador ao elenco do campeonato com 0 pts', async () => {
    const championshipId = await createChampionship('Campeonato Elenco');
    const editionResponse = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: { championshipId, date: '2026-08-01' },
    });
    expect(editionResponse.statusCode).toBe(201);
    const editionId = getCreatedEditionId(editionResponse.json());
    const playerId = await createPlayer('NOVO NO CAMPEONATO');

    const register = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/registrations`,
      headers: organizerHeaders(organizerToken),
      payload: { playerId },
    });
    expect(register.statusCode).toBe(201);

    const roster = await app.inject({
      method: 'GET',
      url: `/championships/${championshipId}/roster`,
    });
    expect(roster.statusCode).toBe(200);
    const entry = roster
      .json<{ roster: Array<{ playerId: string; accumulatedPoints: number }> }>()
      .roster.find((row) => row.playerId === playerId);
    expect(entry).toBeDefined();
    expect(entry?.accumulatedPoints).toBe(0);
  });

  it('rejeita criação de edição com regras inválidas (400)', async () => {
    const championshipId = await createChampionship('Campeonato Regras');
    const response = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: {
        championshipId,
        date: '2026-07-04',
        rules: {
          ...DEFAULT_EDITION_RULES,
          minimumGroupSize: 8,
          preferredGroupSize: 8,
          maximumGroupSize: 4,
        },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toContain('Regras da edição inválidas');
  });

  it('atribui nome sequencial automaticamente por campeonato', async () => {
    const championshipId = await createChampionship('Campeonato Numeração');
    const otherChampionshipId = await createChampionship('Outro Campeonato');

    const first = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: { championshipId, date: '2026-07-04' },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json<{ editions: Array<{ name: string }> }>().editions[0]?.name).toBe(
      'Clandestino #1',
    );

    const second = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: { championshipId, date: '2026-08-01' },
    });
    expect(second.statusCode).toBe(201);
    expect(second.json<{ editions: Array<{ name: string }> }>().editions[0]?.name).toBe(
      'Clandestino #2',
    );

    const otherFirst = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: { championshipId: otherChampionshipId, date: '2026-07-04' },
    });
    expect(otherFirst.statusCode).toBe(201);
    expect(otherFirst.json<{ editions: Array<{ name: string }> }>().editions[0]?.name).toBe(
      'Clandestino #1',
    );
  });

  it('importa CSV com sucesso e registra audit_event', async () => {
    const championshipId = await createChampionship('Campeonato CSV');
    await createPlayer('Ana Souza');
    await createPlayer('Bruno Lima');

    const csv = 'player_name,accumulated_points\nAna Souza,120\nBruno Lima,80\n';
    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csv,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      importedCount: number;
      createdPlayersCount: number;
      skippedExistingCount: number;
    }>();
    expect(body.importedCount).toBe(2);
    expect(body.createdPlayersCount).toBe(0);
    expect(body.skippedExistingCount).toBe(0);

    const audits = await adminQuery(
      `SELECT event_type FROM audit_event WHERE championship_id = ? AND event_type = 'CSV_IMPORTED'`,
      [championshipId],
    );
    expect(audits.length).toBe(1);

    const points = await adminQuery(
      `SELECT accumulated_points FROM championship_player_points WHERE championship_id = ? ORDER BY accumulated_points DESC`,
      [championshipId],
    );
    expect(points.map((row) => Number(row.accumulated_points))).toEqual([120, 80]);
  });

  it('importa CSV com cabeçalhos em português ignorando coluna de posição', async () => {
    const championshipId = await createChampionship('Campeonato CSV PT');
    await createPlayer('LUCAS LIMA');
    await createPlayer('FÁTIMA');

    const csv = 'Posição,Nome,Pontuação\n1,LUCAS LIMA,3947\n23,FÁTIMA,135\n';
    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csv,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      importedCount: number;
      createdPlayersCount: number;
      skippedExistingCount: number;
    }>();
    expect(body.importedCount).toBe(2);
    expect(body.createdPlayersCount).toBe(0);
    expect(body.skippedExistingCount).toBe(0);

    const points = await adminQuery(
      `SELECT accumulated_points FROM championship_player_points WHERE championship_id = ? ORDER BY accumulated_points DESC`,
      [championshipId],
    );
    expect(points.map((row) => Number(row.accumulated_points))).toEqual([3947, 135]);
  });

  it('cadastra jogadores ausentes automaticamente durante a importação', async () => {
    const championshipId = await createChampionship('Campeonato CSV Auto');
    await createPlayer('Ana Souza');

    const csv = 'player_name,accumulated_points\nAna Souza,120\nFantasma,50\n';
    const response = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csv,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      importedCount: number;
      createdPlayersCount: number;
      skippedExistingCount: number;
    }>();
    expect(body.importedCount).toBe(2);
    expect(body.createdPlayersCount).toBe(1);
    expect(body.skippedExistingCount).toBe(0);

    const players = await adminQuery(`SELECT name FROM player ORDER BY name`);
    expect(players.map((row) => row.name)).toEqual(['ANA SOUZA', 'FANTASMA']);

    const points = await adminQuery(
      `SELECT accumulated_points FROM championship_player_points WHERE championship_id = ? ORDER BY accumulated_points DESC`,
      [championshipId],
    );
    expect(points.map((row) => Number(row.accumulated_points))).toEqual([120, 50]);
  });

  it('não sobrescreve pontuações existentes ao reimportar CSV', async () => {
    const championshipId = await createChampionship('Campeonato CSV Reimport');
    await createPlayer('Ana Souza');
    await createPlayer('Bruno Lima');

    const firstCsv = 'player_name,accumulated_points\nAna Souza,120\nBruno Lima,80\n';
    const firstResponse = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: firstCsv,
    });
    expect(firstResponse.statusCode).toBe(200);

    const secondCsv =
      'player_name,accumulated_points\nAna Souza,999\nBruno Lima,1\nCarlos Novo,40\n';
    const secondResponse = await app.inject({
      method: 'POST',
      url: `/championships/${championshipId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: secondCsv,
    });

    expect(secondResponse.statusCode).toBe(200);
    const body = secondResponse.json<{
      importedCount: number;
      createdPlayersCount: number;
      skippedExistingCount: number;
    }>();
    expect(body.importedCount).toBe(1);
    expect(body.createdPlayersCount).toBe(1);
    expect(body.skippedExistingCount).toBe(2);

    const points = await adminQuery(
      `SELECT accumulated_points FROM championship_player_points WHERE championship_id = ? ORDER BY accumulated_points DESC`,
      [championshipId],
    );
    expect(points.map((row) => Number(row.accumulated_points))).toEqual([120, 80, 40]);
  });

  it('isola pontuação entre campeonatos distintos', async () => {
    const championshipA = await createChampionship('Asa Sul');
    const championshipB = await createChampionship('Western');
    await createPlayer('Ana Souza');

    const csvA = 'player_name,accumulated_points\nAna Souza,500\n';
    const csvB = 'player_name,accumulated_points\nAna Souza,100\n';

    await app.inject({
      method: 'POST',
      url: `/championships/${championshipA}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csvA,
    });
    await app.inject({
      method: 'POST',
      url: `/championships/${championshipB}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csvB,
    });

    const pointsA = await adminQuery(
      `SELECT accumulated_points FROM championship_player_points WHERE championship_id = ?`,
      [championshipA],
    );
    const pointsB = await adminQuery(
      `SELECT accumulated_points FROM championship_player_points WHERE championship_id = ?`,
      [championshipB],
    );
    expect(Number(pointsA[0]?.accumulated_points)).toBe(500);
    expect(Number(pointsB[0]?.accumulated_points)).toBe(100);
  });

  it('rejeita CSV acima do limite de tamanho do corpo (413)', async () => {
    const limitedApp = await createTestApp({ CSV_IMPORT_MAX_BYTES: '32' });
    try {
      const token = await loginOrganizer(limitedApp);
      const championshipId = (
        await limitedApp.inject({
          method: 'POST',
          url: '/championships',
          headers: organizerHeaders(token),
          payload: { name: 'Campeonato Limite' },
        })
      ).json<{ id: string }>().id;

      const bigCsv =
        'player_name,accumulated_points\n' +
        Array.from({ length: 50 }, (_, i) => `Jogador ${i},${i}`).join('\n');

      const response = await limitedApp.inject({
        method: 'POST',
        url: `/championships/${championshipId}/import-scores`,
        headers: { ...organizerHeaders(token), 'content-type': 'text/csv' },
        payload: bigCsv,
      });

      expect(response.statusCode).toBe(413);
    } finally {
      await limitedApp.close();
    }
  });
});
