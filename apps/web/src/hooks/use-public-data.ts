import { useQuery } from '@tanstack/react-query';
import {
  fetchChampionship,
  fetchChampionshipEditions,
  fetchChampionshipRanking,
  fetchChampionships,
} from '../lib/public-api.js';
import { queryKeys } from '../lib/query-keys.js';

export function usePublicChampionships(enabled = true) {
  return useQuery({
    queryKey: queryKeys.championships(),
    queryFn: fetchChampionships,
    enabled,
    select: (response) => response.championships.filter((championship) => !championship.archivedAt),
  });
}

export function usePublicChampionship(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId ? queryKeys.championship(championshipId) : ['championship', 'unknown'],
    queryFn: () => fetchChampionship(championshipId!),
    enabled: championshipId !== undefined,
  });
}

export function usePublicChampionshipEditions(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId
      ? queryKeys.championshipEditions(championshipId)
      : ['championship-editions', 'unknown'],
    queryFn: () => fetchChampionshipEditions(championshipId!),
    enabled: championshipId !== undefined,
    select: (response) => response.editions,
  });
}

export function usePublicChampionshipRanking(championshipId: string | undefined) {
  return useQuery({
    queryKey: championshipId
      ? queryKeys.championshipRanking(championshipId)
      : ['championship-ranking', 'unknown'],
    queryFn: () => fetchChampionshipRanking(championshipId!),
    enabled: championshipId !== undefined,
    select: (response) => response.ranking,
  });
}
