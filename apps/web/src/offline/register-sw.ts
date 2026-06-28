import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { OUTBOX_SYNC_MESSAGE } from './outbox.js';
import { syncPendingEditionWizardDrafts } from './sync-pending-wizard-drafts.js';
import { processOutbox } from './process-outbox.js';
import { queryKeys } from '../lib/query-keys.js';
import { getPlayerSession } from '../lib/session.js';

async function flushOutboxFromClient(): Promise<void> {
  const result = await processOutbox();

  if (result.processed > 0 && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'FLUSH_OUTBOX' });
  }
}

export function useOfflineSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      void flushOutboxFromClient().then(async () => {
        await syncPendingEditionWizardDrafts();
        const session = await getPlayerSession();
        if (session) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.matches(session.editionId) });
        }
      });
    };

    const handleOutboxSynced = () => {
      void (async () => {
        const session = await getPlayerSession();
        if (session) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.matches(session.editionId) });
        }
      })();
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OUTBOX_SYNCED') {
        handleOutboxSynced();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(OUTBOX_SYNC_MESSAGE, handleOutboxSynced);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    if (navigator.onLine) {
      void flushOutboxFromClient();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OUTBOX_SYNC_MESSAGE, handleOutboxSynced);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [queryClient]);
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const { registerSW } = await import('virtual:pwa-register');
  registerSW({
    immediate: true,
    onRegistered(registration) {
      if (registration) {
        console.info('[pwa] Service worker registrado');
      }
    },
    onRegisterError(error) {
      console.error('[pwa] Falha ao registrar service worker', error);
    },
  });
}
