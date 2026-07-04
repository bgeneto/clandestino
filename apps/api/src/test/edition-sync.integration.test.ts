import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { EditionFlowClient } from './flow-helpers.js';
import {
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)('sincronização da edição (integração HTTP)', () => {
  let app: FastifyInstance;
  let flow: EditionFlowClient;

  beforeAll(async () => {
    await migrateTestDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
    flow = new EditionFlowClient(app, await loginOrganizer(app));
  });

  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  it('expõe sync-state e incrementa revisão após mutações', async () => {
    const { editionId } = await flow.createFourPlayerTournament();

    const baseline = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/sync-state`,
    });

    expect(baseline.statusCode).toBe(200);
    const baselineRevision = baseline.json<{ editionId: string; syncRevision: number }>()
      .syncRevision;
    expect(baselineRevision).toBeGreaterThanOrEqual(2);
  });

  it('incrementa syncRevision ao registrar placar e ao desistir jogador', async () => {
    const { editionId, matches, playerIds } = await flow.createFourPlayerTournament();
    const beforeSubmit = (
      await app.inject({
        method: 'GET',
        url: `/editions/${editionId}/sync-state`,
      })
    ).json<{ syncRevision: number }>().syncRevision;

    const groups = await flow.getGroups(editionId);
    const groupStageIds = groups
      .filter((entry) => entry.group.phase === 'GROUP_STAGE')
      .map((entry) => entry.group.id);
    const groupMatches = matches.filter((match) => groupStageIds.includes(match.groupId));
    const firstMatch = groupMatches[0]!;

    await flow.submitPlayedResult(
      editionId,
      firstMatch,
      firstMatch.participants[0]!.playerId,
      2,
      0,
    );

    const afterSubmit = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/sync-state`,
    });
    expect(afterSubmit.json<{ syncRevision: number }>().syncRevision).toBe(beforeSubmit + 1);

    const withdrawnPlayerId = playerIds[3]!;
    const withdrawal = await flow.withdrawPlayer(editionId, withdrawnPlayerId);
    expect(withdrawal.statusCode).toBe(200);

    const afterWithdrawal = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/sync-state`,
    });
    expect(afterWithdrawal.json<{ syncRevision: number }>().syncRevision).toBe(beforeSubmit + 2);
  });
});
