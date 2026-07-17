import { useQuery } from '@tanstack/react-query';
import {
  fetchEditionGroups,
  fetchEditionMatches,
  fetchEditionParticipants,
  fetchEditionStandings,
  fetchPlayerMatches,
} from '../lib/edition-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { usePlayerSession } from './use-player-session.js';

export function useEditionGroups(editionId: string | undefined) {
  return useQuery({
    queryKey: editionId ? queryKeys.groups(editionId) : ['groups', 'unknown'],
    queryFn: () => fetchEditionGroups(editionId!),
    enabled: editionId !== undefined,
  });
}

export function useEditionStandings(editionId: string | undefined) {
  return useQuery({
    queryKey: editionId ? queryKeys.standings(editionId) : ['standings', 'unknown'],
    queryFn: () => fetchEditionStandings(editionId!),
    enabled: editionId !== undefined,
  });
}

export function useEditionMatches(editionId: string | undefined) {
  return useQuery({
    queryKey: editionId ? queryKeys.matches(editionId) : ['matches', 'unknown'],
    queryFn: () => fetchEditionMatches(editionId!),
    enabled: editionId !== undefined,
    select: (response) => response.matches,
  });
}

export function usePlayerMatches(editionId: string | undefined, enabled = true) {
  const { session } = usePlayerSession();
  const playerId = session?.playerId;

  return useQuery({
    queryKey:
      editionId && playerId ? queryKeys.matches(editionId, playerId) : ['matches', 'me', 'unknown'],
    queryFn: () => fetchPlayerMatches(editionId!),
    enabled: editionId !== undefined && enabled && Boolean(playerId),
    select: (response) => response.matches,
  });
}

export function useEditionParticipants(editionId: string | undefined) {
  return useQuery({
    queryKey: editionId ? queryKeys.participants(editionId) : ['participants', 'unknown'],
    queryFn: () => fetchEditionParticipants(editionId!),
    enabled: editionId !== undefined,
    select: (response) => response.participants,
  });
}
