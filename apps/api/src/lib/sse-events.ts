import type { FastifyInstance } from 'fastify';

export function emitMatchConfirmed(
  app: FastifyInstance,
  editionId: string,
  payload: { matchId: string; groupId: string },
): void {
  app.sse.emit(editionId, {
    event: 'match_confirmed',
    editionId,
    payload,
  });
  app.sse.emit(editionId, {
    event: 'standing_updated',
    editionId,
    payload: { groupId: payload.groupId },
  });
}

export function emitMatchContested(
  app: FastifyInstance,
  editionId: string,
  payload: { matchId: string },
): void {
  app.sse.emit(editionId, {
    event: 'match_contested',
    editionId,
    payload,
  });
}

export function emitPhasePublished(
  app: FastifyInstance,
  editionId: string,
  payload: { matchesGenerated: number },
): void {
  app.sse.emit(editionId, {
    event: 'phase_published',
    editionId,
    payload,
  });
}
