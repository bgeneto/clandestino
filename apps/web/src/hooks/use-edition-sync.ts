import type { SseEventType } from '@clandestino/shared-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { buildApiUrl } from '../lib/api-config.js';
import { fetchEditionSyncState } from '../lib/edition-sync-api.js';
import {
  getInvalidationKeysForSseEvent,
  getInvalidationKeysForSyncBump,
  invalidateEditionSyncQueries,
  readStoredSyncRevision,
  writeStoredSyncRevision,
} from '../lib/edition-sync-invalidation.js';
import { useOnlineStatus } from './use-online-status.js';

const SSE_EVENTS: SseEventType[] = [
  'match_confirmed',
  'match_result_submitted',
  'phase_published',
  'match_contested',
  'player_withdrawn',
];

const POLL_INTERVAL_SSE_CONNECTED_MS = 8_000;
const POLL_INTERVAL_SSE_DISCONNECTED_MS = 3_000;
const SSE_RECONNECT_BASE_MS = 1_000;
const SSE_RECONNECT_MAX_MS = 30_000;
const POLL_TICK_MS = 2_000;

function isSseEventType(value: string): value is SseEventType {
  return (SSE_EVENTS as readonly string[]).includes(value);
}

function parseRevision(lastEventId: string | null): number | undefined {
  if (!lastEventId) {
    return undefined;
  }

  const parsed = Number.parseInt(lastEventId, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function useEditionSync(
  editionId: string | undefined,
  enabled = false,
  championshipId?: string,
): void {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const lastRevisionRef = useRef(0);
  const sseConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const lastPollAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !editionId || !online) {
      return;
    }

    lastRevisionRef.current = readStoredSyncRevision(editionId);
    let disposed = false;

    const rememberRevision = (revision: number) => {
      if (revision > lastRevisionRef.current) {
        lastRevisionRef.current = revision;
        writeStoredSyncRevision(editionId, revision);
      }
    };

    const handleSseEvent = (event: Event) => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      const eventType = event.type;
      if (!isSseEventType(eventType)) {
        return;
      }

      const revision = parseRevision(event.lastEventId ?? null);
      if (revision !== undefined) {
        rememberRevision(revision);
      }

      void invalidateEditionSyncQueries(
        queryClient,
        editionId,
        getInvalidationKeysForSseEvent(editionId, eventType, championshipId),
      );
    };

    const connectSse = () => {
      if (disposed) {
        return;
      }

      sourceRef.current?.close();
      const lastEventId = lastRevisionRef.current;
      const eventsUrl =
        lastEventId > 0
          ? buildApiUrl(`/editions/${editionId}/events?lastEventId=${lastEventId}`)
          : buildApiUrl(`/editions/${editionId}/events`);
      const source = new EventSource(eventsUrl);
      sourceRef.current = source;

      source.onopen = () => {
        sseConnectedRef.current = true;
        reconnectAttemptRef.current = 0;
      };

      for (const eventName of SSE_EVENTS) {
        source.addEventListener(eventName, handleSseEvent);
      }

      source.onerror = () => {
        sseConnectedRef.current = false;
        source.close();
        sourceRef.current = null;

        if (disposed) {
          return;
        }

        const delay = Math.min(
          SSE_RECONNECT_BASE_MS * 2 ** reconnectAttemptRef.current,
          SSE_RECONNECT_MAX_MS,
        );
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectSse, delay);
      };
    };

    const pollSyncState = async () => {
      if (disposed || document.visibilityState !== 'visible') {
        return;
      }

      const minInterval = sseConnectedRef.current
        ? POLL_INTERVAL_SSE_CONNECTED_MS
        : POLL_INTERVAL_SSE_DISCONNECTED_MS;
      const now = Date.now();
      if (now - lastPollAtRef.current < minInterval) {
        return;
      }
      lastPollAtRef.current = now;

      try {
        const state = await fetchEditionSyncState(editionId);
        if (state.syncRevision > lastRevisionRef.current) {
          rememberRevision(state.syncRevision);
          await invalidateEditionSyncQueries(
            queryClient,
            editionId,
            getInvalidationKeysForSyncBump(editionId, championshipId),
          );
        }
      } catch {
        // rede instável — próximo ciclo tenta de novo
      }
    };

    connectSse();
    void pollSyncState();

    const pollTick = window.setInterval(() => {
      void pollSyncState();
    }, POLL_TICK_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastPollAtRef.current = 0;
        void pollSyncState();
        if (!sseConnectedRef.current && !disposed) {
          connectSse();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(pollTick);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [championshipId, editionId, enabled, online, queryClient]);
}
