import type { EditionSyncState } from '@clandestino/shared-contracts';
import { apiRequest } from './api-client.js';

export async function fetchEditionSyncState(editionId: string): Promise<EditionSyncState> {
  return apiRequest<EditionSyncState>(`/editions/${editionId}/sync-state`);
}
