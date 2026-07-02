import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
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

describe.skipIf(!hasTestDb)('edições vigentes do organizador (integração HTTP)', () => {
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

  async function org(method: 'POST' | 'GET', url: string, payload?: Record<string, unknown>) {
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

  async function createEdition(championshipId: string, date: string): Promise<string> {
    const response = await org('POST', '/editions', {
      championshipId,
      date,
      rules: DEFAULT_TOURNAMENT_RULES,
    });
    expect(response.statusCode).toBe(201);
    return getCreatedEditionId(response.json());
  }

  it('lista edições não encerradas de campeonatos ativos com ação sugerida', async () => {
    const activeChampionshipId = await createChampionship('Ativo');
    const archivedChampionshipId = await createChampionship('Arquivado');
    const activeEditionId = await createEdition(activeChampionshipId, '2026-07-04');
    const archivedEditionId = await createEdition(archivedChampionshipId, '2026-07-05');
    const closedEditionId = await createEdition(activeChampionshipId, '2026-06-01');

    await org('POST', `/championships/${archivedChampionshipId}/archive`);
    await adminQuery(`UPDATE edition SET status = 'ENCERRADA' WHERE id = ?`, [closedEditionId]);

    const response = await org('GET', '/organizer/active-editions');
    expect(response.statusCode).toBe(200);

    const editions = response.json<{
      editions: Array<{
        id: string;
        championshipName: string;
        status: string;
        needsOrganizerAction: boolean;
        actionLabel: string | null;
      }>;
    }>().editions;

    expect(editions.map((edition) => edition.id)).toEqual([activeEditionId]);
    expect(editions[0]).toMatchObject({
      id: activeEditionId,
      championshipName: 'Ativo',
      status: 'RASCUNHO',
      needsOrganizerAction: true,
      actionLabel: 'Configurar edição',
    });
    expect(editions.some((edition) => edition.id === archivedEditionId)).toBe(false);
    expect(editions.some((edition) => edition.id === closedEditionId)).toBe(false);
  });

  it('rejeita acesso sem autenticação', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/organizer/active-editions',
    });
    expect(response.statusCode).toBe(401);
  });
});
