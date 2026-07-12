import type { Match, SubmitMatchResultBody } from '@clandestino/shared-contracts';
import { apiRequest } from '../lib/api-client.js';
import { getOnlineStatus } from '../lib/online-status.js';
import { enqueueSubmitMatchResult } from './outbox.js';
import { processOutbox } from './process-outbox.js';

export type SubmitMatchResultOutcome =
  { mode: 'online'; match: Match } | { mode: 'queued'; outboxId: string };

export async function submitMatchResultOfflineAware(
  matchId: string,
  body: SubmitMatchResultBody,
): Promise<SubmitMatchResultOutcome> {
  if (getOnlineStatus()) {
    try {
      const response = await apiRequest<{ match: Match }>(`/matches/${matchId}/result`, {
        method: 'POST',
        body,
        playerAuth: true,
      });
      return { mode: 'online', match: response.match };
    } catch (error) {
      if (!shouldQueue(error)) {
        throw error;
      }
    }
  }

  const entry = await enqueueSubmitMatchResult(matchId, body);
  return { mode: 'queued', outboxId: entry.id };
}

function shouldQueue(error: unknown): boolean {
  if (!getOnlineStatus()) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

export async function flushOutbox(): Promise<void> {
  await processOutbox();
}
