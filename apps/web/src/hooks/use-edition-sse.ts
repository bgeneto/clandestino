import type { SseEvent, SseEventType } from '@clandestino/shared-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { buildApiUrl } from '../lib/api-config.js';
import { queryKeys } from '../lib/query-keys.js';

const SSE_QUERY_INVALIDATIONS: Record<SseEventType, (editionId: string) => readonly unknown[]> = {
  standing_updated: (editionId) => queryKeys.standings(editionId),
  match_confirmed: (editionId) => ['matches', editionId] as const,
  phase_published: (editionId) => queryKeys.groups(editionId),
  match_contested: (editionId) => queryKeys.contestedMatches(editionId),
};

function parseSsePayload(raw: string): SseEvent | null {
  try {
    return JSON.parse(raw) as SseEvent;
  } catch {
    return null;
  }
}

export function useEditionSse(editionId: string | undefined, enabled = false): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !editionId || !navigator.onLine) {
      return;
    }

    const source = new EventSource(buildApiUrl(`/editions/${editionId}/events`));

    const handleEvent = (event: MessageEvent<string>) => {
      const payload = parseSsePayload(event.data);
      if (!payload) {
        return;
      }

      const queryKeyFactory = SSE_QUERY_INVALIDATIONS[payload.event];
      if (queryKeyFactory) {
        void queryClient.invalidateQueries({ queryKey: queryKeyFactory(payload.editionId) });
      }

      if (payload.event === 'standing_updated' || payload.event === 'match_confirmed') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.standings(payload.editionId) });
      }

      if (payload.event === 'match_confirmed' || payload.event === 'match_contested') {
        void queryClient.invalidateQueries({ queryKey: ['matches', payload.editionId] });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.contestedMatches(payload.editionId),
        });
      }
    };

    for (const eventName of Object.keys(SSE_QUERY_INVALIDATIONS) as SseEventType[]) {
      source.addEventListener(eventName, handleEvent as EventListener);
    }

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [editionId, enabled, queryClient]);
}
