import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestDb,
  createTestApp,
  getCreatedEditionId,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  organizerHeaders,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)('draw plan da edição (integração HTTP)', () => {
  let app: FastifyInstance;
  let organizerToken: string;
  let championshipId: string;
  let editionId: string;
  const playerIds: string[] = [];

  beforeAll(async () => {
    await migrateTestDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
    playerIds.length = 0;
    organizerToken = await loginOrganizer(app);

    const championshipResponse = await app.inject({
      method: 'POST',
      url: '/championships',
      headers: organizerHeaders(organizerToken),
      payload: { name: 'Campeonato Draw Plan' },
    });
    championshipId = championshipResponse.json().id;

    const editionResponse = await app.inject({
      method: 'POST',
      url: '/editions',
      headers: organizerHeaders(organizerToken),
      payload: {
        championshipId,
        date: '2026-08-01',
      },
    });
    editionId = getCreatedEditionId(editionResponse.json());

    for (const name of ['Ana', 'Bruno', 'Carla', 'Daniel', 'Edu', 'Fabio']) {
      const playerResponse = await app.inject({
        method: 'POST',
        url: '/players',
        headers: organizerHeaders(organizerToken),
        payload: { name },
      });
      const playerId = playerResponse.json().id as string;
      playerIds.push(playerId);

      await app.inject({
        method: 'POST',
        url: `/editions/${editionId}/registrations`,
        headers: organizerHeaders(organizerToken),
        payload: { playerId },
      });
    }
  });

  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  it('persiste draw plan parcial e atualiza rules', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/editions/${editionId}`,
      headers: organizerHeaders(organizerToken),
      payload: {
        drawPlan: {
          groupCount: 2,
          groupSizes: [3, 3],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const edition = response.json();
    expect(edition.drawPlan).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
    });
    expect(edition.rules.minimumGroupSize).toBe(3);
    expect(edition.rules.protectedSeedCount).toBe(2);
  });

  it('mescla seeds no draw plan existente', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/editions/${editionId}`,
      headers: organizerHeaders(organizerToken),
      payload: {
        drawPlan: {
          groupCount: 2,
          groupSizes: [3, 3],
        },
      },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/editions/${editionId}`,
      headers: organizerHeaders(organizerToken),
      payload: {
        drawPlan: {
          seedPlayerIds: [playerIds[0], playerIds[1]],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().drawPlan).toEqual({
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: [playerIds[0], playerIds[1]],
    });
  });

  it('rejeita draw plan incompatível com inscritos', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/editions/${editionId}`,
      headers: organizerHeaders(organizerToken),
      payload: {
        drawPlan: {
          groupCount: 2,
          groupSizes: [4, 4],
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('usa defaults novos ao criar edição', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().rules).toEqual(DEFAULT_EDITION_RULES);
  });
});
