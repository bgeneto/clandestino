import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  adminQuery,
  closeAdminPool,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  organizerHeaders,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)('jogadores, temporadas e importação CSV (integração HTTP)', () => {
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
    await closeAdminPool();
  });

  async function createSeason(name: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/seasons',
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

  it('rejeita criação de edição com regras inválidas (400)', async () => {
    const seasonId = await createSeason('Temporada Regras');
    const response = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: {
        seasonId,
        name: 'Edição Inválida',
        date: '2026-07-04',
        rules: {
          ...DEFAULT_TOURNAMENT_RULES,
          // minimumGroupSize > maximumGroupSize → inválido
          minimumGroupSize: 8,
          preferredGroupSize: 8,
          maximumGroupSize: 4,
        },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toContain('Regras de torneio inválidas');
  });

  it('importa CSV com sucesso e registra audit_event', async () => {
    const seasonId = await createSeason('Temporada CSV');
    await createPlayer('Ana Souza');
    await createPlayer('Bruno Lima');

    const csv = 'player_name,accumulated_points\nAna Souza,120\nBruno Lima,80\n';
    const response = await app.inject({
      method: 'POST',
      url: `/seasons/${seasonId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csv,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ importedCount: number }>().importedCount).toBe(2);

    const audits = await adminQuery(
      `SELECT event_type FROM audit_event WHERE season_id = $1 AND event_type = 'CSV_IMPORTED'`,
      [seasonId],
    );
    expect(audits.length).toBe(1);

    const points = await adminQuery(
      `SELECT accumulated_points FROM season_player_points WHERE season_id = $1 ORDER BY accumulated_points DESC`,
      [seasonId],
    );
    expect(points.map((row) => Number(row.accumulated_points))).toEqual([120, 80]);
  });

  it('importa CSV com cabeçalhos em português ignorando coluna de posição', async () => {
    const seasonId = await createSeason('Temporada CSV PT');
    await createPlayer('LUCAS LIMA');
    await createPlayer('FÁTIMA');

    const csv = 'Posição,Nome,Pontuação\n1,LUCAS LIMA,3947\n23,FÁTIMA,135\n';
    const response = await app.inject({
      method: 'POST',
      url: `/seasons/${seasonId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csv,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ importedCount: number }>().importedCount).toBe(2);

    const points = await adminQuery(
      `SELECT accumulated_points FROM season_player_points WHERE season_id = $1 ORDER BY accumulated_points DESC`,
      [seasonId],
    );
    expect(points.map((row) => Number(row.accumulated_points))).toEqual([3947, 135]);
  });

  it('identifica a linha problemática quando o jogador não existe', async () => {
    const seasonId = await createSeason('Temporada CSV Erro');
    await createPlayer('Ana Souza');

    const csv = 'player_name,accumulated_points\nAna Souza,120\nFantasma,50\n';
    const response = await app.inject({
      method: 'POST',
      url: `/seasons/${seasonId}/import-scores`,
      headers: { ...organizerHeaders(organizerToken), 'content-type': 'text/csv' },
      payload: csv,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toMatch(/Linha 3.*Fantasma/);

    // Transação revertida: nenhuma pontuação persistida.
    const points = await adminQuery(
      `SELECT count(*)::int AS total FROM season_player_points WHERE season_id = $1`,
      [seasonId],
    );
    expect(Number(points[0]?.total)).toBe(0);
  });

  it('rejeita CSV acima do limite de tamanho do corpo (413)', async () => {
    const limitedApp = await createTestApp({ CSV_IMPORT_MAX_BYTES: '32' });
    try {
      const token = await loginOrganizer(limitedApp);
      const seasonId = (
        await limitedApp.inject({
          method: 'POST',
          url: '/seasons',
          headers: organizerHeaders(token),
          payload: { name: 'Temporada Limite' },
        })
      ).json<{ id: string }>().id;

      const bigCsv =
        'player_name,accumulated_points\n' +
        Array.from({ length: 50 }, (_, i) => `Jogador ${i},${i}`).join('\n');

      const response = await limitedApp.inject({
        method: 'POST',
        url: `/seasons/${seasonId}/import-scores`,
        headers: { ...organizerHeaders(token), 'content-type': 'text/csv' },
        payload: bigCsv,
      });

      expect(response.statusCode).toBe(413);
    } finally {
      await limitedApp.close();
    }
  });
});
