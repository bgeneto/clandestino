const ORGANIZER_EMAIL = 'organizador@gmail.com';

type E2EMatch = {
  id: string;
  groupId: string;
  status: string;
  outcome?: string;
  bracketRound?: string;
  participants: Array<{ playerId: string; setsWon: number }>;
};

const FLOW_RULES = {
  minimumGroupSize: 4,
  preferredGroupSize: 4,
  maximumGroupSize: 4,
  protectedSeedCount: 1,
  seedingMethod: 'fixed-heads' as const,
  groupRankingCriteria: ['SETS_WON', 'SET_DIFF', 'MATCHES_WON'] as const,
  placementStageFormat: 'round-robin' as const,
};

export const E2E_PLAYER_NAME_PREFIX = 'E2E Jogador';

export interface E2EEditionSetup {
  championshipId: string;
  editionId: string;
  playerIds: string[];
  playerNames: readonly string[];
  organizerSessionToken: string;
  organizerEmail: string;
  organizerExpiresAt: string;
  scheduledGroupMatch: E2EMatch;
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(apiUrl(baseUrl, path), {
    ...init,
    headers,
  });

  const body = (await response.json()) as T;
  return { status: response.status, body };
}

function organizerHeaders(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

function playerHeaders(playerId: string, editionId: string): HeadersInit {
  return {
    'x-player-id': playerId,
    'x-edition-id': editionId,
  };
}

function getCreatedEditionId(body: { editions: Array<{ id: string }> }): string {
  const edition = body.editions[0];
  if (!edition) {
    throw new Error('Resposta de criação de edição sem editions[0].');
  }

  return edition.id;
}

export async function loginOrganizer(baseUrl: string): Promise<{
  sessionToken: string;
  email: string;
  expiresAt: string;
}> {
  const requested = await requestJson<{ magicLink?: string }>(
    baseUrl,
    '/auth/organizer/magic-link',
    {
      method: 'POST',
      body: JSON.stringify({ email: ORGANIZER_EMAIL }),
    },
  );

  if (requested.status !== 200 || !requested.body.magicLink) {
    throw new Error('Magic link do organizador não disponível na resposta.');
  }

  const verifyUrl = new URL(requested.body.magicLink);
  const token = verifyUrl.searchParams.get('token');
  if (!token) {
    throw new Error('Token ausente no magic link do organizador.');
  }

  const verified = await requestJson<{ sessionToken: string; email: string; expiresAt: string }>(
    baseUrl,
    '/auth/organizer/verify',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );

  if (verified.status !== 200) {
    throw new Error(`Falha ao verificar magic link do organizador (${verified.status}).`);
  }

  return {
    sessionToken: verified.body.sessionToken,
    email: verified.body.email,
    expiresAt: verified.body.expiresAt,
  };
}

export async function createEditionWithScheduledGroupMatch(
  baseUrl: string,
): Promise<E2EEditionSetup> {
  const organizer = await loginOrganizer(baseUrl);
  const auth = organizerHeaders(organizer.sessionToken);
  const runId = Date.now();
  const playerNames = [1, 2, 3, 4].map((index) => `${E2E_PLAYER_NAME_PREFIX} ${runId}-${index}`);

  const championship = await requestJson<{ id: string }>(baseUrl, '/championships', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: `E2E Campeonato ${Date.now()}` }),
  });
  if (championship.status !== 201) {
    throw new Error(`Falha ao criar campeonato (${championship.status}).`);
  }

  const playerIds: string[] = [];
  for (const name of playerNames) {
    const created = await requestJson<{ id: string }>(baseUrl, '/players', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name }),
    });
    if (created.status !== 201) {
      throw new Error(`Falha ao criar jogador ${name} (${created.status}).`);
    }
    playerIds.push(created.body.id);
  }

  const edition = await requestJson<{ editions: Array<{ id: string }> }>(baseUrl, '/editions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      championshipId: championship.body.id,
      date: '2026-07-04',
      rules: FLOW_RULES,
      autoConfirmMinutes: 15,
    }),
  });
  if (edition.status !== 201) {
    throw new Error(`Falha ao criar edição (${edition.status}).`);
  }
  const editionId = getCreatedEditionId(edition.body);

  for (const playerId of playerIds) {
    const registration = await requestJson(baseUrl, `/editions/${editionId}/registrations`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ playerId }),
    });
    if (registration.status !== 201) {
      throw new Error(`Falha ao inscrever jogador (${registration.status}).`);
    }
  }

  const draw = await requestJson(baseUrl, `/editions/${editionId}/draw`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ randomSeed: 'e2e-seed' }),
  });
  if (draw.status !== 201) {
    throw new Error(`Falha ao executar sorteio (${draw.status}).`);
  }

  const generated = await requestJson(baseUrl, `/editions/${editionId}/matches/generate`, {
    method: 'POST',
    headers: auth,
  });
  if (generated.status !== 200 && generated.status !== 201) {
    throw new Error(`Falha ao gerar partidas (${generated.status}).`);
  }

  const matches = await requestJson<{ matches: E2EMatch[] }>(
    baseUrl,
    `/editions/${editionId}/matches`,
    {
      headers: auth,
    },
  );
  if (matches.status !== 200) {
    throw new Error(`Falha ao listar partidas (${matches.status}).`);
  }

  const scheduledGroupMatch = matches.body.matches.find((match) => match.status === 'AGENDADA');
  if (!scheduledGroupMatch) {
    throw new Error('Nenhuma partida agendada encontrada para o cenário E2E.');
  }

  return {
    championshipId: championship.body.id,
    editionId,
    playerIds,
    playerNames,
    organizerSessionToken: organizer.sessionToken,
    organizerEmail: organizer.email,
    organizerExpiresAt: organizer.expiresAt,
    scheduledGroupMatch,
  };
}

export function matchParticipantIds(match: E2EMatch): [string, string] {
  const [first, second] = match.participants;
  return [first!.playerId, second!.playerId];
}

export async function submitPlayedResult(
  baseUrl: string,
  editionId: string,
  match: E2EMatch,
  reporterId: string,
): Promise<E2EMatch> {
  const response = await requestJson<{ match: E2EMatch }>(baseUrl, `/matches/${match.id}/result`, {
    method: 'POST',
    headers: playerHeaders(reporterId, editionId),
    body: JSON.stringify({
      outcome: 'PLAYED',
      setsWonByReporter: 2,
      setsWonByOpponent: 0,
    }),
  });

  if (response.status !== 200) {
    throw new Error(`Falha ao registrar placar (${response.status}).`);
  }

  return response.body.match;
}

export async function requestOrganizerVerifyPath(baseUrl: string): Promise<string> {
  const requested = await requestJson<{ magicLink?: string }>(
    baseUrl,
    '/auth/organizer/magic-link',
    {
      method: 'POST',
      body: JSON.stringify({ email: ORGANIZER_EMAIL }),
    },
  );

  if (requested.status !== 200 || !requested.body.magicLink) {
    throw new Error('Magic link do organizador não disponível na resposta.');
  }

  const verifyUrl = new URL(requested.body.magicLink);
  return `${verifyUrl.pathname}${verifyUrl.search}`;
}

export async function confirmMatchResult(
  baseUrl: string,
  editionId: string,
  matchId: string,
  confirmerId: string,
): Promise<E2EMatch> {
  const response = await requestJson<{ match: E2EMatch }>(baseUrl, `/matches/${matchId}/confirm`, {
    method: 'POST',
    headers: playerHeaders(confirmerId, editionId),
  });

  if (response.status !== 200) {
    throw new Error(`Falha ao confirmar placar (${response.status}).`);
  }

  return response.body.match;
}
