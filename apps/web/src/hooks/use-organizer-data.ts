import { useQuery } from '@tanstack/react-query';
import {
  fetchChampionship,
  fetchChampionshipEditions,
  fetchChampionshipRanking,
  fetchChampionshipRoster,
  fetchChampionships,
  fetchContestedMatches,
  fetchDrawSnapshots,
  fetchEditionQr,
  fetchEditionRegistrations,
  fetchFinalPlacements,
  fetchPlayers,
} from '../lib/organizer-api.js';
import { queryKeys } from '../lib/query-keys.js';

export function useChampionships(enabled = true) {
  return useQuery({
    queryKey: queryKeys.championships(),
    queryFn: fetchChampionships,
    enabled,
    select: (response) => response.championships,
  });
}

export function useChampionship(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId ? queryKeys.championship(championshipId) : ['championship', 'unknown'],
    queryFn: () => fetchChampionship(championshipId!),
    enabled: championshipId !== undefined,
  });
}

export function useChampionshipEditions(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId
      ? queryKeys.championshipEditions(championshipId)
      : ['championship-editions', 'unknown'],
    queryFn: () => fetchChampionshipEditions(championshipId!),
    enabled: championshipId !== undefined,
    select: (response) => response.editions,
  });
}

export function useChampionshipRanking(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId
      ? queryKeys.championshipRanking(championshipId)
      : ['championship-ranking', 'unknown'],
    queryFn: () => fetchChampionshipRanking(championshipId!),
    enabled: championshipId !== undefined,
    select: (response) => response.ranking,
  });
}

export function useChampionshipRoster(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId
      ? queryKeys.championshipRoster(championshipId)
      : ['championship-roster', 'unknown'],
    queryFn: () => fetchChampionshipRoster(championshipId!),
    enabled: championshipId !== undefined,
    select: (response) => response.roster,
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
