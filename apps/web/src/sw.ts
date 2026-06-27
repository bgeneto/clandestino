/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { processOutbox } from './offline/process-outbox.js';

declare let self: ServiceWorkerGlobalScope;

clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(({ request }) => request.mode === 'navigate', createHandlerBoundToURL('/index.html'));

registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'font' ||
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-assets',
  }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
  }),
);

async function runOutboxSync(): Promise<void> {
  try {
    await processOutbox();
  } catch (error) {
    console.error('[sw] Falha ao sincronizar fila offline', error);
  }
}

self.addEventListener('online', () => {
  void runOutboxSync();
});

self.addEventListener('sync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string };
  if (syncEvent.tag === 'outbox-sync') {
    syncEvent.waitUntil(runOutboxSync());
  }
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'FLUSH_OUTBOX') {
    event.waitUntil(runOutboxSync());
  }
});

export {};
