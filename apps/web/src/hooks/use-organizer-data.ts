import { useQuery } from '@tanstack/react-query';
import {
  fetchContestedMatches,
  fetchDrawSnapshots,
  fetchEditionQr,
  fetchEditionRegistrations,
  fetchFinalPlacements,
  fetchPlayers,
  fetchSeasons,
} from '../lib/organizer-api.js';
import { queryKeys } from '../lib/query-keys.js';

export function useSeasons(enabled = true) {
  return useQuery({
    queryKey: queryKeys.seasons(),
    queryFn: fetchSeasons,
    enabled,
    select: (response) => response.seasons,
  });
}

export function usePlayers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.players(),
    queryFn: fetchPlayers,
    enabled,
    select: (response) => response.players,
  });
}

export function useEditionRegistrations(editionId: string | undefined) {
  return useQuery({
    queryKey: editionId ? queryKeys.registrations(editionId) : ['registrations', 'unknown'],
    queryFn: () => fetchEditionRegistrations(editionId!),
    enabled: editionId !== undefined,
    select: (response) => response.registrations,
  });
}

export function useDrawSnapshots(editionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: editionId ? queryKeys.drawSnapshots(editionId) : ['draw-snapshots', 'unknown'],
    queryFn: () => fetchDrawSnapshots(editionId!),
    enabled: editionId !== undefined && enabled,
    select: (response) => response.snapshots,
  });
}

export function useEditionQr(editionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: editionId ? queryKeys.editionQr(editionId) : ['edition-qr', 'unknown'],
    queryFn: () => fetchEditionQr(editionId!),
    enabled: editionId !== undefined && enabled,
  });
}

export function useContestedMatches(editionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: editionId ? queryKeys.contestedMatches(editionId) : ['contested-matches', 'unknown'],
    queryFn: () => fetchContestedMatches(editionId!),
    enabled: editionId !== undefined && enabled,
    select: (response) => response.contests,
  });
}

export function useFinalPlacements(editionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: editionId ? queryKeys.finalPlacements(editionId) : ['final-placements', 'unknown'],
    queryFn: () => fetchFinalPlacements(editionId!),
    enabled: editionId !== undefined && enabled,
    select: (response) => response.placements,
  });
}
