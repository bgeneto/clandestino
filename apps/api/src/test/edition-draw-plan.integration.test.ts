import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { executeExplicitDraw } from '@clandestino/tournament-engine';
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

  it('persiste e publica exatamente os grupos aprovados na prévia', async () => {
    const randomSeed = 'approved-preview-seed';
    const seedPlayerIds = [playerIds[0]!, playerIds[1]!];
    const groupSizes = [3, 3];
    const approvedGroups = executeExplicitDraw({
      playerIds,
      seedPlayerIds,
      groupSizes,
      randomSeed,
    }).groups.map((group) => ({
      playerIds: group.players.map((player) => player.playerId),
    }));

    const planResponse = await app.inject({
      method: 'PATCH',
      url: `/editions/${editionId}`,
      headers: organizerHeaders(organizerToken),
      payload: {
        drawPlan: {
          groupCount: 2,
          groupSizes,
          seedPlayerIds,
          randomSeed,
          approvedGroups,
        },
      },
    });

    expect(planResponse.statusCode).toBe(200);
    expect(planResponse.json().drawPlan).toMatchObject({ randomSeed, approvedGroups });

    const drawResponse = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/draw`,
      headers: organizerHeaders(organizerToken),
      payload: {
        groupCount: 2,
        groupSizes,
        seedPlayerIds,
        randomSeed,
        approvedGroups,
      },
    });

    expect(drawResponse.statusCode).toBe(201);
    const publishedGroups = drawResponse
      .json<{ groups: Array<{ players: Array<{ playerId: string }> }> }>()
      .groups.map((group) => group.players.map((player) => player.playerId).sort());
    expect(publishedGroups).toEqual(approvedGroups.map((group) => [...group.playerIds].sort()));
  });

  it('rejeita publicação divergente sem persistir um segundo sorteio', async () => {
    const randomSeed = 'rejected-preview-seed';
    const seedPlayerIds = [playerIds[0]!, playerIds[1]!];
    const groupSizes = [3, 3];
    const approvedGroups = executeExplicitDraw({
      playerIds,
      seedPlayerIds,
      groupSizes,
      randomSeed,
    }).groups.map((group) => ({
      playerIds: group.players.map((player) => player.playerId),
    }));
    const shiftedGroups = approvedGroups.map((group) => ({ playerIds: [...group.playerIds] }));
    const movedPlayer = shiftedGroups[0]!.playerIds[1]!;
    shiftedGroups[0]!.playerIds[1] = shiftedGroups[1]!.playerIds[1]!;
    shiftedGroups[1]!.playerIds[1] = movedPlayer;

    const drawResponse = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/draw`,
      headers: organizerHeaders(organizerToken),
      payload: {
        groupCount: 2,
        groupSizes,
        seedPlayerIds,
        randomSeed,
        approvedGroups: shiftedGroups,
      },
    });

    expect(drawResponse.statusCode).toBe(409);
    expect(drawResponse.json<{ error: string }>().error).toContain('diferem da prévia');

    const groupsResponse = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/groups`,
    });
    expect(groupsResponse.json<{ groups: unknown[] }>().groups).toHaveLength(0);
  });

  it('rejeita cliente antigo que tenta publicar configuração explícita sem prévia', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/editions/${editionId}/draw`,
      headers: organizerHeaders(organizerToken),
      payload: {
        groupCount: 2,
        groupSizes: [3, 3],
        seedPlayerIds: [playerIds[0], playerIds[1]],
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('prévia aprovada');
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
