import type {
  Championship,
  ChampionshipEditionsResponse,
  ChampionshipListResponse,
  ChampionshipRankingResponse,
} from '@clandestino/shared-contracts';
import { apiRequest } from './api-client.js';

export async function fetchChampionships(): Promise<ChampionshipListResponse> {
  return apiRequest<ChampionshipListResponse>('/championships');
}

export async function fetchChampionship(championshipId: string): Promise<Championship> {
  return apiRequest<Championship>(`/championships/${championshipId}`);
}

export async function fetchChampionshipEditions(
  championshipId: string,
): Promise<ChampionshipEditionsResponse> {
  return apiRequest<ChampionshipEditionsResponse>(`/championships/${championshipId}/editions`);
}

export async function fetchChampionshipRanking(
  championshipId: string,
): Promise<ChampionshipRankingResponse> {
  return apiRequest<ChampionshipRankingResponse>(`/championships/${championshipId}/ranking`);
}
