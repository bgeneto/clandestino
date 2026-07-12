import { buildApiUrl } from './api-config.js';

export const ONLINE_PROBE_TIMEOUT_MS = 4_000;
export const ONLINE_POLL_INTERVAL_MS = 30_000;

type OnlineStatusListener = (online: boolean) => void;

let currentOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
const listeners = new Set<OnlineStatusListener>();
let monitorStarted = false;
let probeInFlight: Promise<boolean> | null = null;
let stopMonitor: (() => void) | null = null;
let probeGeneration = 0;

export function getOnlineStatus(): boolean {
  return currentOnline;
}

export function subscribeOnlineStatus(listener: OnlineStatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setOnlineStatus(next: boolean): void {
  if (currentOnline === next) {
    return;
  }

  currentOnline = next;
  for (const listener of listeners) {
    listener(next);
  }
}

/** GET /health — true se a API responde OK (não confia só em navigator.onLine). */
export async function probeApiReachability(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONLINE_PROBE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(buildApiUrl('/health'), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshOnlineStatus(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (probeInFlight) {
    return probeInFlight;
  }

  const generation = probeGeneration;
  probeInFlight = probeApiReachability(fetchImpl)
    .then((reachable) => {
      if (generation !== probeGeneration) {
        return currentOnline;
      }
      setOnlineStatus(reachable);
      return reachable;
    })
    .finally(() => {
      if (generation === probeGeneration) {
        probeInFlight = null;
      }
    });

  return probeInFlight;
}

/**
 * Monitor único: eventos do browser + probe periódico + ao voltar à aba.
 * Idempotente — permanece ativo pela vida do SPA.
 */
export function startOnlineStatusMonitor(fetchImpl: typeof fetch = fetch): void {
  if (monitorStarted) {
    return;
  }

  monitorStarted = true;

  const handleOffline = () => {
    setOnlineStatus(false);
  };

  const handleOnline = () => {
    void refreshOnlineStatus(fetchImpl);
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      void refreshOnlineStatus(fetchImpl);
    }
  };

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void refreshOnlineStatus(fetchImpl);
    }
  }, ONLINE_POLL_INTERVAL_MS);

  void refreshOnlineStatus(fetchImpl);

  stopMonitor = () => {
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearInterval(intervalId);
    monitorStarted = false;
    stopMonitor = null;
  };
}

/** Só para testes — reinicia estado do módulo. */
export function resetOnlineStatusForTests(online = true): void {
  stopMonitor?.();
  probeGeneration += 1;
  currentOnline = online;
  listeners.clear();
  probeInFlight = null;
  monitorStarted = false;
  stopMonitor = null;
}
