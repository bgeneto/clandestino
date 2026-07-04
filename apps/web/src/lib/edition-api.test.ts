import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edition, EditionParticipantsResponse } from '@clandestino/shared-contracts';
import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { db } from '../db/clandestino-db.js';
import {
  cacheEdition,
  cacheParticipants,
  getCachedEdition,
  getCachedParticipants,
} from './edition-cache.js';
import { fetchEdition, fetchEditionParticipants } from './edition-api.js';

const editionId = '11111111-1111-4111-8111-111111111111';

const editionFixture: Edition = {
  id: editionId,
  championshipId: '22222222-2222-4222-8222-222222222222',
  name: 'Clandestino #1',
  date: '2026-06-28',
  status: 'EM_ANDAMENTO',
  autoConfirmMinutes: 60,
  syncRevision: 0,
  rules: DEFAULT_EDITION_RULES,
  createdAt: '2026-06-28T00:00:00.000Z',
};

const participantsFixture: EditionParticipantsResponse = {
  participants: [
    {
      playerId: '33333333-3333-4333-8333-333333333333',
      playerName: 'Alice',
      rankPosition: 1,
      accumulatedPoints: 10,
      isSeed: true,
    },
  ],
};

function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('edition-api offline fallback', () => {
  beforeEach(async () => {
    await db.edition.clear();
    await db.participants.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não usa cache quando a API retorna 404', async () => {
    await cacheEdition(editionFixture);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, { error: 'Edição não encontrada.' })),
    );

    await expect(fetchEdition(editionId)).rejects.toMatchObject({ status: 404 });
    expect(await getCachedEdition(editionId)).toEqual(editionFixture);
  });

  it('usa cache em falha de rede', async () => {
    await cacheEdition(editionFixture);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(fetchEdition(editionId)).resolves.toEqual(editionFixture);
  });

  it('usa cache em erro 5xx', async () => {
    await cacheEdition(editionFixture);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, { error: 'Erro interno.' })),
    );

    await expect(fetchEdition(editionId)).resolves.toEqual(editionFixture);
  });

  it('participants: não usa cache em 404', async () => {
    await cacheParticipants(editionId, participantsFixture);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, { error: 'Edição não encontrada.' })),
    );

    await expect(fetchEditionParticipants(editionId)).rejects.toMatchObject({ status: 404 });
    expect(await getCachedParticipants(editionId)).toEqual(participantsFixture);
  });

  it('participants: usa cache em falha de rede', async () => {
    await cacheParticipants(editionId, participantsFixture);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(fetchEditionParticipants(editionId)).resolves.toEqual(participantsFixture);
  });
});
