import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { SseHub, formatSseMessage } from './sse.js';

function createMockResponse(): ServerResponse {
  const emitter = new EventEmitter();
  const chunks: string[] = [];

  return {
    writableEnded: false,
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      (this as { writableEnded: boolean }).writableEnded = true;
      emitter.emit('close');
    },
    on(event: string, listener: () => void) {
      emitter.on(event, listener);
      return this;
    },
    getWrittenChunks() {
      return chunks;
    },
  } as unknown as ServerResponse & { getWrittenChunks(): string[] };
}

describe('formatSseMessage', () => {
  it('formats event name and JSON payload', () => {
    const message = formatSseMessage({
      event: 'match_confirmed',
      editionId: '550e8400-e29b-41d4-a716-446655440000',
      payload: { matchId: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(message).toBe(
      'event: match_confirmed\n' +
        'data: {"event":"match_confirmed","editionId":"550e8400-e29b-41d4-a716-446655440000","payload":{"matchId":"550e8400-e29b-41d4-a716-446655440001"}}\n\n',
    );
  });
});

describe('SseHub', () => {
  it('delivers events to connected clients for an edition', () => {
    const hub = new SseHub();
    const editionId = '550e8400-e29b-41d4-a716-446655440010';
    const response = createMockResponse();
    const client = hub.addClient(editionId, response);

    hub.emit(editionId, {
      event: 'standing_updated',
      editionId,
      payload: { groupId: '550e8400-e29b-41d4-a716-446655440011' },
    });

    const chunks = (
      response as ServerResponse & { getWrittenChunks(): string[] }
    ).getWrittenChunks();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('event: standing_updated');

    hub.removeClient(editionId, client);
    expect(hub.clientCount(editionId)).toBe(0);
  });

  it('ignores disconnected clients without throwing', () => {
    const hub = new SseHub();
    const editionId = '550e8400-e29b-41d4-a716-446655440020';
    const response = createMockResponse();
    const client = hub.addClient(editionId, response);
    response.end();

    expect(() => {
      hub.emit(editionId, {
        event: 'match_contested',
        editionId,
        payload: { matchId: '550e8400-e29b-41d4-a716-446655440021' },
      });
    }).not.toThrow();

    hub.removeClient(editionId, client);
    expect(hub.clientCount(editionId)).toBe(0);
  });

  it('does not deliver events to clients of other editions', () => {
    const hub = new SseHub();
    const editionA = '550e8400-e29b-41d4-a716-446655440030';
    const editionB = '550e8400-e29b-41d4-a716-446655440031';
    const responseA = createMockResponse();
    const responseB = createMockResponse();

    hub.addClient(editionA, responseA);
    hub.addClient(editionB, responseB);

    hub.emit(editionA, {
      event: 'phase_published',
      editionId: editionA,
      payload: { matchesGenerated: 3 },
    });

    const chunksA = (
      responseA as ServerResponse & { getWrittenChunks(): string[] }
    ).getWrittenChunks();
    const chunksB = (
      responseB as ServerResponse & { getWrittenChunks(): string[] }
    ).getWrittenChunks();

    expect(chunksA).toHaveLength(1);
    expect(chunksB).toHaveLength(0);
  });
});
