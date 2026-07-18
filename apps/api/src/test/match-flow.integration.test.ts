import { DEFAULT_SCORING_TABLE, DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import type { Match } from '@clandestino/shared-contracts';
import { pointsForPosition } from '@clandestino/tournament-engine';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  getCreatedEditionId,
  organizerHeaders,
  playerHeaders,
  truncateAll,
} from './integration-setup.js';

// Regras forçando 1 grupo de 4 jogadores.
const FLOW_RULES = {
  ...DEFAULT_TOURNAMENT_RULES,
  minimumGroupSize: 4,
  preferredGroupSize: 4,
  maximumGroupSize: 4,
  protectedSeedCount: 1,
};

describe.skipIf(!hasTestDb)('fluxo de partidas e autorização (integração HTTP)', () => {
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
    const response = await app.inject({
      method,
      url,
      headers: organizerHeaders(organizerToken),
      payload,
    });
    return response;
  }

  interface FlowContext {
    editionId: string;
    playerIds: string[];
    matches: Match[];
  }

  async function setupTournament(): Promise<FlowContext> {
    const championshipId = (
      await org('POST', '/championships', { name: `Campeonato ${Date.now()}` })
    ).json<{
      id: string;
    }>().id;

    const playerNames = ['Ana', 'Bruno', 'Carla', 'Daniel'];
    const playerIds: string[] = [];
    for (const name of playerNames) {
      const created = await org('POST', '/players', { name });
      playerIds.push(created.json<{ id: string }>().id);
    }

    const edition = await org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      rules: FLOW_RULES,
      autoConfirmMinutes: 15,
    });
    expect(edition.statusCode).toBe(201);
    const editionId = getCreatedEditionId(edition.json());

    for (const playerId of playerIds) {
      const reg = await org('POST', `/editions/${editionId}/registrations`, { playerId });
      expect(reg.statusCode).toBe(201);
    }

    const draw = await org('POST', `/editions/${editionId}/draw`, {
      randomSeed: 'integration-seed',
    });
    expect(draw.statusCode).toBe(201);

    const generated = await org('POST', `/editions/${editionId}/matches/generate`);
    expect([200, 201]).toContain(generated.statusCode);

    const matchesResponse = await org('GET', `/editions/${editionId}/matches`);
    const matches = matchesResponse.json<{ matches: Match[] }>().matches;

    return { editionId, playerIds, matches };
  }

  function participants(match: Match): [string, string] {
    const [first, second] = match.participants;
    return [first!.playerId, second!.playerId];
  }

  it('gera round-robin de 6 partidas para 1 grupo de 4', async () => {
    const { matches } = await setupTournament();
    expect(matches).toHaveLength(6);
    for (const match of matches) {
      expect(match.status).toBe('AGENDADA');
    }
  });

  it('rejeita placar empatado com 422 (2x2)', async () => {
    const { editionId, matches } = await setupTournament();
    const match = matches[0]!;
    const [reporter] = participants(match);

    const response = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/result`,
      headers: playerHeaders(reporter, editionId),
      payload: { setsWonByReporter: 3, setsWonByOpponent: 3 },
    });
    expect(response.statusCode).toBe(422);
  });

  it('impede que um não-participante registre o resultado (403)', async () => {
    const { editionId, playerIds, matches } = await setupTournament();
    const match = matches[0]!;
    const [reporter, opponent] = participants(match);
    const outsider = playerIds.find((id) => id !== reporter && id !== opponent)!;

    const response = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/result`,
      headers: playerHeaders(outsider, editionId),
      payload: { setsWonByReporter: 3, setsWonByOpponent: 0 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('impede ação cruzada entre edições (403)', async () => {
    const { editionId, matches } = await setupTournament();
    const match = matches[0]!;
    const [reporter] = participants(match);

    // Cria uma segunda edição e inscreve o mesmo jogador nela.
    const otherChampionshipId = (
      await org('POST', '/championships', { name: `Campeonato Outro ${Date.now()}` })
    ).json<{ id: string }>().id;
    const otherEditionId = getCreatedEditionId(
      (
        await org('POST', '/editions', {
          championshipId: otherChampionshipId,
          date: '2026-07-11',
          rules: FLOW_RULES,
        })
      ).json(),
    );
    await org('POST', `/editions/${otherEditionId}/registrations`, { playerId: reporter });

    const response = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/result`,
      headers: playerHeaders(reporter, otherEditionId),
      payload: { setsWonByReporter: 3, setsWonByOpponent: 0 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('registra, bloqueia auto-confirmação e confirma pelo adversário', async () => {
    const { editionId, matches } = await setupTournament();
    const match = matches[0]!;
    const [reporter, opponent] = participants(match);

    const submit = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/result`,
      headers: playerHeaders(reporter, editionId),
      payload: { setsWonByReporter: 3, setsWonByOpponent: 0 },
    });
    expect(submit.statusCode).toBe(200);
    expect(submit.json<{ match: Match }>().match.status).toBe('AGUARDANDO_CONFIRMACAO');

    // Quem registrou não pode confirmar o próprio resultado.
    const selfConfirm = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/confirm`,
      headers: playerHeaders(reporter, editionId),
    });
    expect(selfConfirm.statusCode).toBe(403);

    const confirm = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/confirm`,
      headers: playerHeaders(opponent, editionId),
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json<{ match: Match }>().match.status).toBe('CONFIRMADA');
  });

  it('recalcula standing e encerra com pontos conforme scoring_table', async () => {
    const { editionId, matches } = await setupTournament();

    // Confirma todas as 6 partidas (reporter vence 2x0).
    for (const match of matches) {
      const [reporter, opponent] = participants(match);
      const submit = await app.inject({
        method: 'POST',
        url: `/matches/${match.id}/result`,
        headers: playerHeaders(reporter, editionId),
        payload: { setsWonByReporter: 3, setsWonByOpponent: 0 },
      });
      expect(submit.statusCode).toBe(200);

      const confirm = await app.inject({
        method: 'POST',
        url: `/matches/${match.id}/confirm`,
        headers: playerHeaders(opponent, editionId),
      });
      expect(confirm.statusCode).toBe(200);
    }

    // Standing recalculado no servidor: 4 jogadores classificados.
    const standings = await org('GET', `/editions/${editionId}/standings`);
    const standingGroups = standings.json<{ groups: Array<{ standings: unknown[] }> }>().groups;
    const totalRanked = standingGroups.reduce((sum, group) => sum + group.standings.length, 0);
    expect(totalRanked).toBe(4);

    // Fase de colocação gerada automaticamente.
    const edition = await org('GET', `/editions/${editionId}`);
    expect(edition.json<{ status: string }>().status).toBe('FASE_COLOCACAO');

    const publish = await org('POST', `/editions/${editionId}/placement/publish`);
    expect(publish.statusCode).toBe(409);

    // Encerramento atribui pontos conforme a tabela padrão da temporada.
    const finalize = await org('POST', `/editions/${editionId}/finalize`);
    expect(finalize.statusCode).toBe(200);
    const placements = finalize
      .json<{ placements: Array<{ position: number; pointsAwarded: number }> }>()
      .placements.slice()
      .sort((a, b) => a.position - b.position);

    expect(placements.map((placement) => placement.position)).toEqual([1, 2, 3, 4]);
    for (const placement of placements) {
      expect(placement.pointsAwarded).toBe(
        pointsForPosition(placement.position, DEFAULT_SCORING_TABLE),
      );
    }
  });

  it('bloqueia encerramento com partidas AGENDADA', async () => {
    const { editionId } = await setupTournament();

    const finalize = await org('POST', `/editions/${editionId}/finalize`);
    expect(finalize.statusCode).toBe(409);
    expect(finalize.json<{ error: string }>().error).toContain('sem resultado confirmado');
  });

  it('bloqueia encerramento em SORTEIO_PUBLICADO sem partidas geradas', async () => {
    const championshipId = (
      await org('POST', '/championships', { name: `Campeonato ${Date.now()}` })
    ).json<{ id: string }>().id;

    const playerNames = ['Ana', 'Bruno', 'Carla', 'Daniel'];
    const playerIds: string[] = [];
    for (const name of playerNames) {
      const created = await org('POST', '/players', { name });
      playerIds.push(created.json<{ id: string }>().id);
    }

    const edition = await org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      rules: FLOW_RULES,
    });
    const editionId = getCreatedEditionId(edition.json());

    for (const playerId of playerIds) {
      const reg = await org('POST', `/editions/${editionId}/registrations`, { playerId });
      expect(reg.statusCode).toBe(201);
    }

    const draw = await org('POST', `/editions/${editionId}/draw`, {
      randomSeed: 'integration-seed',
    });
    expect(draw.statusCode).toBe(201);

    const finalize = await org('POST', `/editions/${editionId}/finalize`);
    expect(finalize.statusCode).toBe(409);
    expect(finalize.json<{ error: string }>().error).toContain('Gere as partidas');
  });

  it('permite organizador oficializar partida AGENDADA e avançar fase', async () => {
    const { editionId, matches } = await setupTournament();

    for (const match of matches) {
      const [playerOneId, playerTwoId] = participants(match);
      const officialize = await app.inject({
        method: 'PUT',
        url: `/matches/${match.id}/result`,
        headers: organizerHeaders(organizerToken),
        payload: {
          setsWonByPlayerOne: 3,
          setsWonByPlayerTwo: 0,
        },
      });
      expect(officialize.statusCode).toBe(200);
      expect(officialize.json<{ match: Match }>().match.status).toBe('CONFIRMADA');
      void playerOneId;
      void playerTwoId;
    }

    const edition = await org('GET', `/editions/${editionId}`);
    expect(edition.json<{ status: string }>().status).toBe('FASE_COLOCACAO');

    const finalize = await org('POST', `/editions/${editionId}/finalize`);
    expect(finalize.statusCode).toBe(200);
  });

  it('contestar e confirmar em paralelo: exatamente um vence (CAS)', async () => {
    const { editionId, matches } = await setupTournament();
    const match = matches[0]!;
    const [playerOneId, playerTwoId] = participants(match);

    const submit = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/result`,
      headers: playerHeaders(playerOneId, editionId),
      payload: { setsWonByReporter: 3, setsWonByOpponent: 0 },
    });
    expect(submit.statusCode).toBe(200);

    const [confirm, contest] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/matches/${match.id}/confirm`,
        headers: playerHeaders(playerTwoId, editionId),
      }),
      app.inject({
        method: 'POST',
        url: `/matches/${match.id}/contest`,
        headers: playerHeaders(playerTwoId, editionId),
        payload: { reason: 'placar errado' },
      }),
    ]);

    const statuses = [confirm.statusCode, contest.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    const finalMatch = await app.inject({
      method: 'GET',
      url: `/editions/${editionId}/matches`,
    });
    const updated = finalMatch
      .json<{ matches: Match[] }>()
      .matches.find((entry) => entry.id === match.id);
    expect(updated?.status === 'CONFIRMADA' || updated?.status === 'CONTESTADA').toBe(true);
  });

  it('correção do organizador após contestação persiste CORRIGIDA', async () => {
    const { editionId, matches } = await setupTournament();
    const match = matches[0]!;
    const [playerOneId, playerTwoId] = participants(match);

    await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/result`,
      headers: playerHeaders(playerOneId, editionId),
      payload: { setsWonByReporter: 3, setsWonByOpponent: 1 },
    });

    const contest = await app.inject({
      method: 'POST',
      url: `/matches/${match.id}/contest`,
      headers: playerHeaders(playerTwoId, editionId),
      payload: { reason: 'set invertido' },
    });
    expect(contest.statusCode).toBe(200);
    expect(contest.json<{ match: Match }>().match.status).toBe('CONTESTADA');

    const corrected = await app.inject({
      method: 'PUT',
      url: `/matches/${match.id}/result`,
      headers: organizerHeaders(organizerToken),
      payload: {
        setsWonByPlayerOne: 1,
        setsWonByPlayerTwo: 3,
      },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json<{ match: Match }>().match.status).toBe('CORRIGIDA');
  });
});
