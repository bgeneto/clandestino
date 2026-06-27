import type { SseEvent } from '@clandestino/shared-contracts';
import type { ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export type SseClient = {
  id: string;
  response: ServerResponse;
};

export class SseHub {
  private readonly clientsByEdition = new Map<string, Set<SseClient>>();

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

  emit(editionId: string, event: SseEvent): void {
    const clients = this.clientsByEdition.get(editionId);
    if (!clients || clients.size === 0) {
      return;
    }

    const payload = formatSseMessage(event);
    for (const client of clients) {
      try {
        if (!client.response.writableEnded) {
          client.response.write(payload);
        }
      } catch {
        clients.delete(client);
      }
    }
  }

  clientCount(editionId: string): number {
    return this.clientsByEdition.get(editionId)?.size ?? 0;
  }
}

export function formatSseMessage(event: SseEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.event}\ndata: ${data}\n\n`;
}

export function writeSseConnected(response: ServerResponse): void {
  response.write(': connected\n\n');
}

export function writeSseKeepAlive(response: ServerResponse): void {
  response.write(': keep-alive\n\n');
}
