import type { SseEventType } from '@clandestino/shared-contracts';
import type { ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export type SseWireMessage = {
  revision: number;
  event: SseEventType;
  data: {
    m?: string;
    g?: string;
    p?: string;
    n?: number;
  };
};

export type SseClient = {
  id: string;
  response: ServerResponse;
};

const REPLAY_BUFFER_SIZE = 50;

export class SseHub {
  private readonly clientsByEdition = new Map<string, Set<SseClient>>();
  private readonly replayBufferByEdition = new Map<string, SseWireMessage[]>();

  addClient(editionId: string, response: ServerResponse): SseClient {
    const client: SseClient = { id: randomUUID(), response };
    const clients = this.clientsByEdition.get(editionId) ?? new Set<SseClient>();
    clients.add(client);
    this.clientsByEdition.set(editionId, clients);
    return client;
  }

  removeClient(editionId: string, client: SseClient): void {
    const clients = this.clientsByEdition.get(editionId);
    if (!clients) {
      return;
    }

    clients.delete(client);
    if (clients.size === 0) {
      this.clientsByEdition.delete(editionId);
    }
  }

  replayAfter(editionId: string, lastRevision: number, response: ServerResponse): void {
    const buffer = this.replayBufferByEdition.get(editionId) ?? [];
    for (const message of buffer) {
      if (message.revision > lastRevision) {
        this.writeMessage(response, message);
      }
    }
  }

  emit(editionId: string, message: SseWireMessage): void {
    this.appendToBuffer(editionId, message);

    const clients = this.clientsByEdition.get(editionId);
    if (!clients || clients.size === 0) {
      return;
    }

    for (const client of clients) {
      try {
        if (!client.response.writableEnded) {
          this.writeMessage(client.response, message);
        }
      } catch {
        clients.delete(client);
      }
    }
  }

  clientCount(editionId: string): number {
    return this.clientsByEdition.get(editionId)?.size ?? 0;
  }

  private appendToBuffer(editionId: string, message: SseWireMessage): void {
    const buffer = this.replayBufferByEdition.get(editionId) ?? [];
    buffer.push(message);
    if (buffer.length > REPLAY_BUFFER_SIZE) {
      buffer.splice(0, buffer.length - REPLAY_BUFFER_SIZE);
    }
    this.replayBufferByEdition.set(editionId, buffer);
  }

  private writeMessage(response: ServerResponse, message: SseWireMessage): void {
    response.write(formatSseMessage(message));
  }
}

export function formatSseMessage(message: SseWireMessage): string {
  const data = JSON.stringify(message.data);
  return `id: ${message.revision}\nevent: ${message.event}\ndata: ${data}\n\n`;
}

export function writeSseConnected(response: ServerResponse): void {
  response.write(': connected\n\n');
}

export function writeSseKeepAlive(response: ServerResponse): void {
  response.write(': keep-alive\n\n');
}

export function parseLastEventId(header: string | string[] | undefined): number {
  if (!header) {
    return 0;
  }

  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Prefer the browser-managed `Last-Event-ID` header when present.
 * Falling back to the query param supports manual EventSource reconnects
 * that bake the resume point into the URL.
 */
export function resolveSseResumeRevision(
  headerValue: string | string[] | undefined,
  queryValue: string | undefined,
): number {
  const headerRevision = parseLastEventId(headerValue);
  if (headerRevision > 0) {
    return headerRevision;
  }
  return parseLastEventId(queryValue);
}
