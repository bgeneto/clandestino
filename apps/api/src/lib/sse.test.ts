import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { SseHub, formatSseMessage, parseLastEventId, resolveSseResumeRevision } from './sse.js';

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
  it('formats slim id, event and data payload', () => {
    const message = formatSseMessage({
      revision: 7,
      event: 'match_confirmed',
      data: {
        m: '550e8400-e29b-41d4-a716-446655440001',
        g: '550e8400-e29b-41d4-a716-446655440002',
      },
    });

    expect(message).toBe(
      'id: 7\n' +
        'event: match_confirmed\n' +
        'data: {"m":"550e8400-e29b-41d4-a716-446655440001","g":"550e8400-e29b-41d4-a716-446655440002"}\n\n',
    );
  });
});

describe('parseLastEventId', () => {
  it('parses numeric header', () => {
    expect(parseLastEventId('12')).toBe(12);
    expect(parseLastEventId(undefined)).toBe(0);
    expect(parseLastEventId('invalid')).toBe(0);
  });
});

describe('resolveSseResumeRevision', () => {
  it('prefers Last-Event-ID header over a larger stale query value', () => {
    expect(resolveSseResumeRevision('5', '99')).toBe(5);
  });

  it('falls back to query when header is absent', () => {
    expect(resolveSseResumeRevision(undefined, '7')).toBe(7);
  });

  it('returns 0 when neither source has a valid revision', () => {
    expect(resolveSseResumeRevision(undefined, undefined)).toBe(0);
  });
});

describe('SseHub', () => {
  it('delivers events to connected clients for an edition', () => {
    const hub = new SseHub();
    const editionId = '550e8400-e29b-41d4-a716-446655440010';
    const response = createMockResponse();
    const client = hub.addClient(editionId, response);

    hub.emit(editionId, {
      revision: 3,
      event: 'match_result_submitted',
      data: { m: '550e8400-e29b-41d4-a716-446655440011' },
    });

    const chunks = (
      response as ServerResponse & { getWrittenChunks(): string[] }
    ).getWrittenChunks();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('event: match_result_submitted');
    expect(chunks[0]).toContain('id: 3');

    hub.removeClient(editionId, client);
    expect(hub.clientCount(editionId)).toBe(0);
  });

  it('replays buffered events after last revision', () => {
    const hub = new SseHub();
    const editionId = '550e8400-e29b-41d4-a716-446655440012';
    const response = createMockResponse();

    hub.emit(editionId, {
      revision: 1,
      event: 'match_result_submitted',
      data: { m: '550e8400-e29b-41d4-a716-446655440013' },
    });
    hub.emit(editionId, {
      revision: 2,
      event: 'player_withdrawn',
      data: { p: '550e8400-e29b-41d4-a716-446655440014' },
    });

    hub.replayAfter(editionId, 1, response);

    const chunks = (
      response as ServerResponse & { getWrittenChunks(): string[] }
    ).getWrittenChunks();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('player_withdrawn');
    expect(chunks[0]).toContain('id: 2');
  });

  it('ignores disconnected clients without throwing', () => {
    const hub = new SseHub();
    const editionId = '550e8400-e29b-41d4-a716-446655440020';
    const response = createMockResponse();
    const client = hub.addClient(editionId, response);
    response.end();

    expect(() => {
      hub.emit(editionId, {
        revision: 1,
        event: 'match_contested',
        data: { m: '550e8400-e29b-41d4-a716-446655440021' },
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
      revision: 1,
      event: 'phase_published',
      data: { n: 3 },
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
