import type {
  ArchiveChampionshipResponse,
  Championship,
  ChampionshipEditionsResponse,
  ChampionshipListResponse,
  ChampionshipRankingResponse,
  ChampionshipRosterResponse,
  CorrectMatchResultBody,
  CreateChampionshipBody,
  CreateEditionBody,
  DeleteChampionshipResponse,
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
  OrganizerSessionStatus,
  Player,
  PlayerListResponse,
  CreatePlayerBody,
  PublishPlacementResponse,
  RegisterPlayerBody,
  RequestOrganizerMagicLinkBody,
  RequestOrganizerMagicLinkResponse,
  UnarchiveChampionshipResponse,
  UpdateScoringTableBody,
  VerifyOrganizerMagicLinkBody,
} from '@clandestino/shared-contracts';
import { apiRequest, ApiError } from './api-client.js';
import { buildApiUrl } from './api-config.js';
import { getOrganizerSession } from './organizer-session.js';
import { invalidateOrganizerSession } from './organizer-session-guard.js';

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

export async function fetchOrganizerSession(): Promise<OrganizerSessionStatus> {
  return apiRequest<OrganizerSessionStatus>('/auth/organizer/session', {
    ...organizer,
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

export async function fetchChampionshipRoster(
  championshipId: string,
): Promise<ChampionshipRosterResponse> {
  return apiRequest<ChampionshipRosterResponse>(`/championships/${championshipId}/roster`);
}

export async function deleteChampionship(
  championshipId: string,
): Promise<DeleteChampionshipResponse> {
  return apiRequest<DeleteChampionshipResponse>(`/championships/${championshipId}`, {
    method: 'DELETE',
    ...organizer,
  });
}

export async function archiveChampionship(
  championshipId: string,
): Promise<ArchiveChampionshipResponse> {
  return apiRequest<ArchiveChampionshipResponse>(`/championships/${championshipId}/archive`, {
    method: 'POST',
    ...organizer,
  });
}

export async function unarchiveChampionship(
  championshipId: string,
): Promise<UnarchiveChampionshipResponse> {
  return apiRequest<UnarchiveChampionshipResponse>(`/championships/${championshipId}/unarchive`, {
    method: 'POST',
    ...organizer,
  });
}

export async function fetchPlayers(): Promise<PlayerListResponse> {
  return apiRequest<PlayerListResponse>('/players');
}

export async function createPlayer(body: CreatePlayerBody): Promise<Player> {
  return apiRequest<Player>('/players', {
    method: 'POST',
    body,
    ...organizer,
  });
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

export async function unregisterPlayer(
  editionId: string,
  playerId: string,
): Promise<EditionRegistrationsResponse> {
  return apiRequest<EditionRegistrationsResponse>(
    `/editions/${editionId}/registrations/${playerId}`,
    {
      method: 'DELETE',
      ...organizer,
    },
  );
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
  const session = await getOrganizerSession();
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

    if (response.status === 401) {
      await invalidateOrganizerSession();
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as ImportScoresResponse;
}
