import type { ApprovedDrawGroup, EditionDrawPlan } from '@clandestino/shared-contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { ApiError } from '../lib/api-client.js';
import { queryKeys } from '../lib/query-keys.js';
import { updateEdition } from '../lib/organizer-api.js';

export function buildDrawPlanFromDraft(draft: EditionWizardDraft): EditionDrawPlan | null {
  if (draft.groupCount === undefined || draft.groupSizes === undefined) {
    return null;
  }

  const approvedGroups = buildApprovedGroupsFromDraft(draft);

  return {
    groupCount: draft.groupCount,
    groupSizes: draft.groupSizes,
    ...(draft.seedPlayerIds ? { seedPlayerIds: draft.seedPlayerIds } : {}),
    ...(draft.drawRandomSeed && approvedGroups
      ? { randomSeed: draft.drawRandomSeed, approvedGroups }
      : {}),
  };
}

export function buildApprovedGroupsFromDraft(
  draft: EditionWizardDraft,
): ApprovedDrawGroup[] | undefined {
  if (!draft.drawPreview?.length) {
    return undefined;
  }

  return draft.drawPreview.map((group) => ({
    playerIds: group.players.map((player) => player.playerId),
  }));
}

export async function syncWizardDrawPlan(
  draft: EditionWizardDraft,
  queryClient: QueryClient,
): Promise<EditionWizardDraft> {
  if (!draft.editionId) {
    return draft;
  }

  const drawPlan = buildDrawPlanFromDraft(draft);
  if (!drawPlan) {
    return draft;
  }

  try {
    const updatedEdition = await updateEdition(draft.editionId, { drawPlan });
    await queryClient.setQueryData(queryKeys.edition(draft.editionId), updatedEdition);
    return draft;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw error;
  }
}
