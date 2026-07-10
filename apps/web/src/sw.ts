/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { processOutbox } from './offline/process-outbox.js';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('api-cache'));
});

registerRoute(
  ({ url, request }) => request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
  createHandlerBoundToURL('/index.html'),
);

registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

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
