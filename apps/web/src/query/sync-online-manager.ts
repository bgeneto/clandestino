import { onlineManager } from '@tanstack/react-query';
import {
  getOnlineStatus,
  startOnlineStatusMonitor,
  subscribeOnlineStatus,
} from '../lib/online-status.js';

let synced = false;

/**
 * Alinha o onlineManager do React Query com o monitor de reachability da API.
 *
 * Sem isso, um `offline` falso do browser pausa mutations/queries para sempre,
 * enquanto o ConnectionStatus já voltou a "Online" via probe de `/health`.
 */
export function syncReactQueryOnlineManager(fetchImpl: typeof fetch = fetch): void {
  if (synced) {
    return;
  }

  synced = true;
  startOnlineStatusMonitor(fetchImpl);
  onlineManager.setOnline(getOnlineStatus());
  onlineManager.setEventListener((setOnline) => {
    setOnline(getOnlineStatus());
    return subscribeOnlineStatus(setOnline);
  });
}

/** Só para testes. */
export function resetReactQueryOnlineManagerSyncForTests(): void {
  synced = false;
}
