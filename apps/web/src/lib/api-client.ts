import type { SubmitMatchResultBody } from '@clandestino/shared-contracts';
import { buildApiUrl } from './api-config.js';
import { getOrganizerSession } from './organizer-session.js';
import { invalidateOrganizerSession } from './organizer-session-guard.js';
import { db, SESSION_ROW_ID } from '../db/clandestino-db.js';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  playerAuth?: boolean;
  organizerAuth?: boolean;
};

async function readOrganizerHeaders(): Promise<Record<string, string>> {
  const session = await getOrganizerSession();
  if (!session) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.sessionToken}`,
  };
}

async function readSessionHeaders(): Promise<Record<string, string>> {
  const session = await db.session.get(SESSION_ROW_ID);
  if (!session) {
    return {};
  }

  return {
    'X-Player-Id': session.playerId,
    'X-Edition-Id': session.editionId,
  };
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.playerAuth) {
    const sessionHeaders = await readSessionHeaders();
    for (const [key, value] of Object.entries(sessionHeaders)) {
      headers.set(key, value);
    }
  }

  if (options.organizerAuth) {
    const organizerHeaders = await readOrganizerHeaders();
    for (const [key, value] of Object.entries(organizerHeaders)) {
      headers.set(key, value);
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    cache: options.cache ?? 'no-store',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    let details: unknown;

    try {
      const payload = (await response.json()) as { error?: string; details?: unknown };
      if (payload.error) {
        message = payload.error;
      }
      details = payload.details;
    } catch {
      // resposta não-JSON
    }

    if (response.status === 401 && options.organizerAuth) {
      await invalidateOrganizerSession();
    }

    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function submitMatchResult(
  matchId: string,
  body: SubmitMatchResultBody,
): Promise<Response> {
  const sessionHeaders = await readSessionHeaders();
  return fetch(buildApiUrl(`/matches/${matchId}/result`), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...sessionHeaders,
    },
    body: JSON.stringify(body),
  });
}
