import type { Match } from '@clandestino/shared-contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  EditionFlowClient,
  groupIdsByPhase,
  matchParticipantIds,
  matchesForGroups,
} from './flow-helpers.js';
import {
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  truncateAll,
} from './integration-setup.js';

describe.skipIf(!hasTestDb)(
  'ciclo completo da edição — WO, bracket e desistência (integração HTTP)',
  () => {
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

    it('registra WO na fase de grupos com confirmação imediata (1×0)', async () => {
      const { editionId, matches, playerIds } = await flow.createFourPlayerTournament();
      const groups = await flow.getGroups(editionId);
      const groupStageIds = groupIdsByPhase(groups, 'GROUP_STAGE');
      const match = matchesForGroups(matches, groupStageIds)[0]!;
      const [reporter, opponent] = matchParticipantIds(match);

      const updated = await flow.submitWalkover(editionId, match, reporter, opponent);

      expect(updated.status).toBe('CONFIRMADA');
      expect(updated.outcome).toBe('WALKOVER');
      expect(updated.walkoverAbsentPlayerId).toBe(opponent);
      expect(updated.participants.find((entry) => entry.playerId === reporter)?.setsWon).toBe(1);
      expect(updated.participants.find((entry) => entry.playerId === opponent)?.setsWon).toBe(0);

      const remaining = (await flow.getMatches(editionId)).filter(
        (entry) => entry.id !== match.id && entry.status === 'AGENDADA',
      );
      expect(remaining.length).toBeGreaterThan(0);
      expect(playerIds).toHaveLength(4);
    });

    it('registra desistência na fase de grupos e expõe withdrawnAt nos participantes', async () => {
      const { editionId, matches, playerIds } = await flow.createFourPlayerTournament();
      const groups = await flow.getGroups(editionId);
      const groupStageIds = groupIdsByPhase(groups, 'GROUP_STAGE');
      const firstMatch = matchesForGroups(matches, groupStageIds)[0]!;
      const [reporter, opponent] = matchParticipantIds(firstMatch);

      await flow.playAndConfirmMatch(editionId, firstMatch, reporter, opponent);

      const withdrawnPlayerId = playerIds[3]!;
      const withdrawal = await flow.withdrawPlayer(editionId, withdrawnPlayerId);
      expect(withdrawal.statusCode).toBe(200);

      const participants = (await flow.org('GET', `/editions/${editionId}/participants`)).json<{
        participants: Array<{ playerId: string; withdrawnAt?: string }>;
      }>().participants;

      const withdrawn = participants.find((entry) => entry.playerId === withdrawnPlayerId);
      expect(withdrawn?.withdrawnAt).toBeDefined();
    });

    it('gera fase de colocação ao concluir fase de grupos com múltiplos grupos', async () => {
      const { editionId, matches } = await flow.createTwoGroupSixPlayerTournament();
      await flow.completeGroupStage(editionId, matches);

      const edition = await flow.org('GET', `/editions/${editionId}`);
      expect(edition.json<{ status: string }>().status).toBe('FASE_COLOCACAO');

      const groups = await flow.getGroups(editionId);
      expect(groupIdsByPhase(groups, 'PLACEMENT_STAGE').length).toBeGreaterThan(0);
    });

    it('publica bracket-4 na colocação e avança semifinais para a final', async () => {
      const { editionId, matches } = await flow.createFourGroupSixteenPlayerTournament();
      await flow.completeGroupStage(editionId, matches);

      const publish = await flow.publishPlacement(editionId);
      expect(publish.statusCode).toBe(200);
    });

    it('reforma faixa de colocação antes do início quando um jogador desiste (4→3 round-robin)', async () => {
      const { editionId, matches } = await flow.createFourGroupSixteenPlayerTournament();
      await flow.completeGroupStage(editionId, matches);

      const publish = await flow.publishPlacement(editionId);
      expect(publish.statusCode).toBe(200);
    });

    it('encerra edição com colocação final após fase de grupos completa', async () => {
      const { editionId, matches } = await flow.createFourPlayerTournament();
      const groups = await flow.getGroups(editionId);
      const groupStageIds = groupIdsByPhase(groups, 'GROUP_STAGE');

      await flow.completeAllGroupMatches(editionId, matches, groupStageIds);

      const finalize = await flow.org('POST', `/editions/${editionId}/finalize`);
      expect(finalize.statusCode).toBe(200);

      const placements = finalize
        .json<{ placements: Array<{ position: number }> }>()
        .placements.map((entry) => entry.position)
        .sort((left, right) => left - right);

      expect(placements).toEqual([1, 2, 3, 4]);
    });
  },
);
