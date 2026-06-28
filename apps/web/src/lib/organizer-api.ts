import type {
  Championship,
  ChampionshipEditionsResponse,
  ChampionshipListResponse,
  ChampionshipRankingResponse,
  CorrectMatchResultBody,
  CreateChampionshipBody,
  CreateEditionBody,
  DrawSnapshotListResponse,
  Edition,
  EditionContestedMatchesResponse,
  EditionFinalPlacementsResponse,
  EditionGroupsResponse,
  EditionQrResponse,
  EditionRegistrationsResponse,
  ExecuteDrawBody,
  FinalizeEditionResponse,
  GenerateMatchesResponse,
  ImportScoresResponse,
  OrganizerSessionResponse,
  PlayerListResponse,
  PublishPlacementResponse,
  RegisterPlayerBody,
  RequestOrganizerMagicLinkBody,
  RequestOrganizerMagicLinkResponse,
  UpdateScoringTableBody,
  VerifyOrganizerMagicLinkBody,
} from '@clandestino/shared-contracts';
import { apiRequest, ApiError } from './api-client.js';
import { buildApiUrl } from './api-config.js';
import { db, ORGANIZER_SESSION_ROW_ID } from '../db/clandestino-db.js';

const organizer = { organizerAuth: true } as const;

export async function requestOrganizerMagicLink(
  body: RequestOrganizerMagicLinkBody,
): Promise<RequestOrganizerMagicLinkResponse> {
  return apiRequest<RequestOrganizerMagicLinkResponse>('/auth/organizer/magic-link', {
    method: 'POST',
    body,
  });
}

export async function verifyOrganizerMagicLink(
  body: VerifyOrganizerMagicLinkBody,
): Promise<OrganizerSessionResponse> {
  return apiRequest<OrganizerSessionResponse>('/auth/organizer/verify', {
    method: 'POST',
    body,
  });
}

export async function fetchChampionships(): Promise<ChampionshipListResponse> {
  return apiRequest<ChampionshipListResponse>('/championships');
}

export async function fetchChampionship(championshipId: string): Promise<Championship> {
  return apiRequest<Championship>(`/championships/${championshipId}`);
}

export async function createChampionship(body: CreateChampionshipBody): Promise<Championship> {
  return apiRequest<Championship>('/championships', {
    method: 'POST',
    body,
    ...organizer,
  });
}

export async function updateChampionshipScoringTable(
  championshipId: string,
  body: UpdateScoringTableBody,
): Promise<Championship> {
  return apiRequest<Championship>(`/championships/${championshipId}/scoring-table`, {
    method: 'PUT',
    body,
    ...organizer,
  });
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

export async function fetchPlayers(): Promise<PlayerListResponse> {
  return apiRequest<PlayerListResponse>('/players');
}

export async function createEdition(body: CreateEditionBody): Promise<Edition> {
  return apiRequest<Edition>('/editions', {
    method: 'POST',
    body,
    ...organizer,
  });
}

export async function fetchEditionRegistrations(
  editionId: string,
): Promise<EditionRegistrationsResponse> {
  return apiRequest<EditionRegistrationsResponse>(`/editions/${editionId}/registrations`);
}

export async function registerPlayer(
  editionId: string,
  body: RegisterPlayerBody,
): Promise<EditionRegistrationsResponse> {
  return apiRequest<EditionRegistrationsResponse>(`/editions/${editionId}/registrations`, {
    method: 'POST',
    body,
    ...organizer,
  });
}

export async function executeDraw(
  editionId: string,
  body: ExecuteDrawBody = {},
): Promise<EditionGroupsResponse> {
  return apiRequest<EditionGroupsResponse>(`/editions/${editionId}/draw`, {
    method: 'POST',
    body,
    ...organizer,
  });
}

export async function cancelDraw(editionId: string): Promise<Edition> {
  return apiRequest<Edition>(`/editions/${editionId}/draw`, {
    method: 'DELETE',
    ...organizer,
  });
}

export async function generateMatches(editionId: string): Promise<GenerateMatchesResponse> {
  return apiRequest<GenerateMatchesResponse>(`/editions/${editionId}/matches/generate`, {
    method: 'POST',
    ...organizer,
  });
}

export async function fetchEditionQr(editionId: string): Promise<EditionQrResponse> {
  return apiRequest<EditionQrResponse>(`/editions/${editionId}/qr`);
}

export async function fetchDrawSnapshots(editionId: string): Promise<DrawSnapshotListResponse> {
  return apiRequest<DrawSnapshotListResponse>(`/editions/${editionId}/draw-snapshots`);
}

export async function fetchContestedMatches(
  editionId: string,
): Promise<EditionContestedMatchesResponse> {
  return apiRequest<EditionContestedMatchesResponse>(`/editions/${editionId}/contested-matches`);
}

export async function correctMatchResult(
  matchId: string,
  body: CorrectMatchResultBody,
): Promise<void> {
  await apiRequest(`/matches/${matchId}/result`, {
    method: 'PUT',
    body,
    ...organizer,
  });
}

export async function publishPlacementStage(editionId: string): Promise<PublishPlacementResponse> {
  return apiRequest<PublishPlacementResponse>(`/editions/${editionId}/placement/publish`, {
    method: 'POST',
    ...organizer,
  });
}

export async function finalizeEdition(editionId: string): Promise<FinalizeEditionResponse> {
  return apiRequest<FinalizeEditionResponse>(`/editions/${editionId}/finalize`, {
    method: 'POST',
    ...organizer,
  });
}

export async function fetchFinalPlacements(
  editionId: string,
): Promise<EditionFinalPlacementsResponse> {
  return apiRequest<EditionFinalPlacementsResponse>(`/editions/${editionId}/final-placements`);
}

export async function importChampionshipScores(
  championshipId: string,
  csvContent: string,
): Promise<ImportScoresResponse> {
  const session = await db.organizerSession.get(ORGANIZER_SESSION_ROW_ID);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'text/csv',
  };

  if (session) {
    headers.Authorization = `Bearer ${session.sessionToken}`;
  }

  const response = await fetch(buildApiUrl(`/championships/${championshipId}/import-scores`), {
    method: 'POST',
    headers,
    body: csvContent,
  });

  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // resposta não-JSON
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as ImportScoresResponse;
}
