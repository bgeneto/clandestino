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

describe.skipIf(!hasTestDb)('link e QR da edição (integração HTTP)', () => {
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

  it('retorna URL de participação para edição em rascunho', async () => {
    const championship = await org('POST', '/championships', { name: 'Campeonato QR' });
    expect(championship.statusCode).toBe(201);
    const championshipId = championship.json<{ id: string }>().id;

    const edition = await org('POST', '/editions', {
      championshipId,
      date: '2026-09-01',
      autoConfirmMinutes: 15,
    });
    expect(edition.statusCode).toBe(201);
    const editionId = getCreatedEditionId(edition.json());

    const qr = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/qr`,
    });
    expect(qr.statusCode).toBe(200);

    const body = qr.json<{ editionId: string; url: string; editionName: string }>();
    expect(body.editionId).toBe(editionId);
    expect(body.url).toContain(`/edicao/${editionId}/entrar`);
  });

  it('lista participantes inscritos em edição em rascunho', async () => {
    const championship = await org('POST', '/championships', { name: 'Campeonato Check-in' });
    const championshipId = championship.json<{ id: string }>().id;

    const edition = await org('POST', '/editions', {
      championshipId,
      date: '2026-09-02',
      autoConfirmMinutes: 15,
    });
    const editionId = getCreatedEditionId(edition.json());

    const player = await org('POST', '/players', { name: 'Jogador QR' });
    const playerId = player.json<{ id: string }>().id;

    const registration = await org('POST', `/editions/${editionId}/registrations`, { playerId });
    expect(registration.statusCode).toBe(201);

    const participants = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/participants`,
    });
    expect(participants.statusCode).toBe(200);

    const body = participants.json<{ participants: { playerId: string; playerName: string }[] }>();
    expect(body.participants).toHaveLength(1);
    expect(body.participants[0]?.playerName).toBe('JOGADOR QR');
  });
});
