import type { FastifyInstance } from 'fastify';
import { bumpEditionSyncRevision } from './edition-sync.js';

export async function emitMatchConfirmed(
  app: FastifyInstance,
  editionId: string,
  payload: { matchId: string; groupId: string },
): Promise<void> {
  const revision = await bumpEditionSyncRevision(app.db, editionId);
  app.sse.emit(editionId, {
    revision,
    event: 'match_confirmed',
    data: { m: payload.matchId, g: payload.groupId },
  });
}

export async function emitMatchResultSubmitted(
  app: FastifyInstance,
  editionId: string,
  payload: { matchId: string },
): Promise<void> {
  const revision = await bumpEditionSyncRevision(app.db, editionId);
  app.sse.emit(editionId, {
    revision,
    event: 'match_result_submitted',
    data: { m: payload.matchId },
  });
}

export async function emitMatchContested(
  app: FastifyInstance,
  editionId: string,
  payload: { matchId: string },
): Promise<void> {
  const revision = await bumpEditionSyncRevision(app.db, editionId);
  app.sse.emit(editionId, {
    revision,
    event: 'match_contested',
    data: { m: payload.matchId },
  });
}

export async function emitPhasePublished(
  app: FastifyInstance,
  editionId: string,
  payload: { matchesGenerated: number },
): Promise<void> {
  const revision = await bumpEditionSyncRevision(app.db, editionId);
  app.sse.emit(editionId, {
    revision,
    event: 'phase_published',
    data: { n: payload.matchesGenerated },
  });
}

export async function emitPlayerWithdrawn(
  app: FastifyInstance,
  editionId: string,
  payload: { playerId: string },
): Promise<void> {
  const revision = await bumpEditionSyncRevision(app.db, editionId);
  app.sse.emit(editionId, {
    revision,
    event: 'player_withdrawn',
    data: { p: payload.playerId },
  });
}

/** Incrementa revisão sem SSE — polling cobre mutações sem evento dedicado. */
export async function bumpEditionSyncOnly(
  app: FastifyInstance,
  editionId: string,
): Promise<number> {
  return bumpEditionSyncRevision(app.db, editionId);
}
