import { DEFAULT_TOURNAMENT_RULES } from '@clandestino/shared-contracts';
import type { EditionGroupsResponse, Match } from '@clandestino/shared-contracts';
import { executeExplicitDraw } from '@clandestino/tournament-engine';
import { expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getCreatedEditionId, organizerHeaders, playerHeaders } from './integration-setup.js';

type InjectResponse = Awaited<ReturnType<FastifyInstance['inject']>>;

export const FLOW_RULES_FOUR_SINGLE_GROUP = {
  ...DEFAULT_TOURNAMENT_RULES,
  minimumGroupSize: 4,
  preferredGroupSize: 4,
  maximumGroupSize: 4,
  protectedSeedCount: 1,
};

export const FLOW_PLAYER_NAMES = ['Ana', 'Bruno', 'Carla', 'Daniel'] as const;

export const FLOW_SIXTEEN_PLAYER_NAMES = Array.from(
  { length: 16 },
  (_, index) => `Jogador ${index + 1}`,
) as readonly string[];

export interface TournamentFlowContext {
  championshipId: string;
  editionId: string;
  playerIds: string[];
  playerNames: readonly string[];
  matches: Match[];
}

export function matchParticipantIds(match: Match): [string, string] {
  const [first, second] = match.participants;
  return [first!.playerId, second!.playerId];
}

export function groupIdsByPhase(groups: EditionGroupsResponse['groups'], phase: string): string[] {
  return groups.filter((entry) => entry.group.phase === phase).map((entry) => entry.group.id);
}

export function matchesForGroups(matches: Match[], groupIds: readonly string[]): Match[] {
  const groupIdSet = new Set(groupIds);
  return matches.filter((match) => groupIdSet.has(match.groupId));
}

function approvedGroupsForExplicitDraw(input: {
  playerIds: string[];
  seedPlayerIds: string[];
  groupSizes: number[];
  randomSeed: string;
}): Array<{ playerIds: string[] }> {
  return executeExplicitDraw(input).groups.map((group) => ({
    playerIds: group.players.map((player) => player.playerId),
  }));
}

export class EditionFlowClient {
  constructor(
    private readonly app: FastifyInstance,
    private organizerToken: string,
  ) {}

  setOrganizerToken(token: string): void {
    this.organizerToken = token;
  }

  async org(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<InjectResponse> {
    return this.app.inject({
      method,
      url,
      headers: organizerHeaders(this.organizerToken),
      payload,
    });
  }

  async player(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    playerId: string,
    editionId: string,
    payload?: Record<string, unknown>,
  ): Promise<InjectResponse> {
    return this.app.inject({
      method,
      url,
      headers: playerHeaders(playerId, editionId),
      payload,
    });
  }

  async createFourPlayerTournament(
    rules = FLOW_RULES_FOUR_SINGLE_GROUP,
    playerNames: readonly string[] = FLOW_PLAYER_NAMES,
    randomSeed = 'flow-test-seed',
  ): Promise<TournamentFlowContext> {
    const championshipId = (
      await this.org('POST', '/championships', { name: `Campeonato ${Date.now()}` })
    ).json<{ id: string }>().id;

    const playerIds: string[] = [];
    for (const name of playerNames) {
      const created = await this.org('POST', '/players', { name });
      expect(created.statusCode).toBe(201);
      playerIds.push(created.json<{ id: string }>().id);
    }

    const edition = await this.org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      rules,
      autoConfirmMinutes: 15,
    });
    expect(edition.statusCode).toBe(201);
    const editionId = getCreatedEditionId(edition.json());

    for (const playerId of playerIds) {
      const registration = await this.org('POST', `/editions/${editionId}/registrations`, {
        playerId,
      });
      expect(registration.statusCode).toBe(201);
    }

    const draw = await this.org('POST', `/editions/${editionId}/draw`, { randomSeed });
    expect(draw.statusCode).toBe(201);

    const generated = await this.org('POST', `/editions/${editionId}/matches/generate`);
    expect([200, 201]).toContain(generated.statusCode);

    const matches = (await this.org('GET', `/editions/${editionId}/matches`)).json<{
      matches: Match[];
    }>().matches;

    return { championshipId, editionId, playerIds, playerNames, matches };
  }

  async createTwoGroupSixPlayerTournament(
    randomSeed = 'flow-six-seed',
  ): Promise<TournamentFlowContext> {
    const playerNames = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduardo', 'Fernanda'] as const;
    const championshipId = (
      await this.org('POST', '/championships', { name: `Campeonato ${Date.now()}` })
    ).json<{ id: string }>().id;

    const playerIds: string[] = [];
    for (const name of playerNames) {
      const created = await this.org('POST', '/players', { name });
      expect(created.statusCode).toBe(201);
      playerIds.push(created.json<{ id: string }>().id);
    }

    const edition = await this.org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      rules: {
        ...DEFAULT_TOURNAMENT_RULES,
        minimumGroupSize: 3,
        preferredGroupSize: 3,
        maximumGroupSize: 3,
        protectedSeedCount: 2,
      },
      autoConfirmMinutes: 15,
    });
    expect(edition.statusCode).toBe(201);
    const editionId = getCreatedEditionId(edition.json());

    for (const playerId of playerIds) {
      const registration = await this.org('POST', `/editions/${editionId}/registrations`, {
        playerId,
      });
      expect(registration.statusCode).toBe(201);
    }

    const explicitDraw = {
      randomSeed,
      groupCount: 2,
      groupSizes: [3, 3],
      seedPlayerIds: playerIds.slice(0, 2),
    };
    const draw = await this.org('POST', `/editions/${editionId}/draw`, {
      ...explicitDraw,
      approvedGroups: approvedGroupsForExplicitDraw({
        playerIds,
        seedPlayerIds: explicitDraw.seedPlayerIds,
        groupSizes: explicitDraw.groupSizes,
        randomSeed,
      }),
    });
    expect(draw.statusCode).toBe(201);

    const generated = await this.org('POST', `/editions/${editionId}/matches/generate`);
    expect([200, 201]).toContain(generated.statusCode);

    const matches = (await this.org('GET', `/editions/${editionId}/matches`)).json<{
      matches: Match[];
    }>().matches;

    return { championshipId, editionId, playerIds, playerNames, matches };
  }

  async createFourGroupSixteenPlayerTournament(
    randomSeed = 'flow-sixteen-seed',
  ): Promise<TournamentFlowContext> {
    const playerNames = FLOW_SIXTEEN_PLAYER_NAMES;
    const championshipId = (
      await this.org('POST', '/championships', { name: `Campeonato ${Date.now()}` })
    ).json<{ id: string }>().id;

    const playerIds: string[] = [];
    for (const name of playerNames) {
      const created = await this.org('POST', '/players', { name });
      expect(created.statusCode).toBe(201);
      playerIds.push(created.json<{ id: string }>().id);
    }

    const edition = await this.org('POST', '/editions', {
      championshipId,
      date: '2026-07-04',
      rules: {
        ...DEFAULT_TOURNAMENT_RULES,
        minimumGroupSize: 4,
        preferredGroupSize: 4,
        maximumGroupSize: 4,
        protectedSeedCount: 4,
      },
      autoConfirmMinutes: 15,
    });
    expect(edition.statusCode).toBe(201);
    const editionId = getCreatedEditionId(edition.json());

    for (const playerId of playerIds) {
      const registration = await this.org('POST', `/editions/${editionId}/registrations`, {
        playerId,
      });
      expect(registration.statusCode).toBe(201);
    }

    const explicitDraw = {
      randomSeed,
      groupCount: 4,
      groupSizes: [4, 4, 4, 4],
      seedPlayerIds: playerIds.slice(0, 4),
    };
    const draw = await this.org('POST', `/editions/${editionId}/draw`, {
      ...explicitDraw,
      approvedGroups: approvedGroupsForExplicitDraw({
        playerIds,
        seedPlayerIds: explicitDraw.seedPlayerIds,
        groupSizes: explicitDraw.groupSizes,
        randomSeed,
      }),
    });
    expect(draw.statusCode).toBe(201);

    const generated = await this.org('POST', `/editions/${editionId}/matches/generate`);
    expect([200, 201]).toContain(generated.statusCode);

    const matches = (await this.org('GET', `/editions/${editionId}/matches`)).json<{
      matches: Match[];
    }>().matches;

    return { championshipId, editionId, playerIds, playerNames, matches };
  }

  async completeGroupStage(editionId: string, initialMatches: Match[]): Promise<void> {
    const groups = await this.getGroups(editionId);
    const groupStageIds = groupIdsByPhase(groups, 'GROUP_STAGE');
    let matches = initialMatches;

    for (const match of matchesForGroups(matches, groupStageIds)) {
      if (match.status !== 'AGENDADA') {
        continue;
      }

      const [reporter, opponent] = matchParticipantIds(match);
      await this.playAndConfirmMatch(editionId, match, reporter, opponent);
    }
  }

  async submitPlayedResult(
    editionId: string,
    match: Match,
    reporterId: string,
    setsWonByReporter = 3,
    setsWonByOpponent = 0,
  ): Promise<Match> {
    const response = await this.player(
      'POST',
      `/matches/${match.id}/result`,
      reporterId,
      editionId,
      {
        outcome: 'PLAYED',
        setsWonByReporter,
        setsWonByOpponent,
      },
    );
    expect(response.statusCode).toBe(200);
    return response.json<{ match: Match }>().match;
  }

  async submitWalkover(
    editionId: string,
    match: Match,
    reporterId: string,
    absentPlayerId: string,
  ): Promise<Match> {
    const response = await this.player(
      'POST',
      `/matches/${match.id}/result`,
      reporterId,
      editionId,
      {
        outcome: 'WALKOVER',
        absentPlayerId,
      },
    );
    expect(response.statusCode).toBe(200);
    return response.json<{ match: Match }>().match;
  }

  async confirmResult(editionId: string, matchId: string, confirmerId: string): Promise<Match> {
    const response = await this.player(
      'POST',
      `/matches/${matchId}/confirm`,
      confirmerId,
      editionId,
    );
    expect(response.statusCode).toBe(200);
    return response.json<{ match: Match }>().match;
  }

  async playAndConfirmMatch(
    editionId: string,
    match: Match,
    reporterId: string,
    opponentId: string,
    setsWonByReporter = 3,
    setsWonByOpponent = 0,
  ): Promise<Match> {
    const submitted = await this.submitPlayedResult(
      editionId,
      match,
      reporterId,
      setsWonByReporter,
      setsWonByOpponent,
    );
    expect(submitted.status).toBe('AGUARDANDO_CONFIRMACAO');
    return this.confirmResult(editionId, match.id, opponentId);
  }

  async completeAllGroupMatches(
    editionId: string,
    matches: Match[],
    groupIds: readonly string[],
  ): Promise<void> {
    for (const match of matchesForGroups(matches, groupIds)) {
      const [reporter, opponent] = matchParticipantIds(match);
      await this.playAndConfirmMatch(editionId, match, reporter, opponent);
    }
  }

  async getGroups(editionId: string): Promise<EditionGroupsResponse['groups']> {
    const response = await this.org('GET', `/editions/${editionId}/groups`);
    expect(response.statusCode).toBe(200);
    return response.json<EditionGroupsResponse>().groups;
  }

  async getMatches(editionId: string): Promise<Match[]> {
    const response = await this.org('GET', `/editions/${editionId}/matches`);
    expect(response.statusCode).toBe(200);
    return response.json<{ matches: Match[] }>().matches;
  }

  async publishPlacement(editionId: string): Promise<InjectResponse> {
    return this.org('POST', `/editions/${editionId}/placement/publish`);
  }

  async officializeMatch(
    matchId: string,
    body: {
      outcome?: 'PLAYED' | 'WALKOVER';
      absentPlayerId?: string;
      setsWonByPlayerOne?: number;
      setsWonByPlayerTwo?: number;
    },
  ): Promise<InjectResponse> {
    return this.org('PUT', `/matches/${matchId}/result`, body);
  }

  async withdrawPlayer(editionId: string, playerId: string): Promise<InjectResponse> {
    return this.org('POST', `/editions/${editionId}/withdrawals`, { playerId });
  }
}
