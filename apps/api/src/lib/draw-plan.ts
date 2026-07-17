import type { EditionDrawPlan, EditionRules } from '@clandestino/shared-contracts';
import {
  drawMatchesApprovedGroups,
  executeExplicitDraw,
  partitionPlayersIntoGroups,
  WIZARD_MIN_GROUP_SIZE,
} from '@clandestino/tournament-engine';

export function mergeDrawPlan(
  current: EditionDrawPlan | null | undefined,
  patch: EditionDrawPlan | null | undefined,
): EditionDrawPlan | null {
  if (patch === null) {
    return null;
  }

  if (patch === undefined) {
    return current ?? null;
  }

  const merged: EditionDrawPlan = { ...(current ?? {}), ...patch };
  const changesDrawInput =
    patch.groupCount !== undefined ||
    patch.groupSizes !== undefined ||
    patch.seedPlayerIds !== undefined;
  const includesApprovedPreview =
    patch.randomSeed !== undefined || patch.approvedGroups !== undefined;

  if (changesDrawInput && !includesApprovedPreview) {
    delete merged.randomSeed;
    delete merged.approvedGroups;
  }

  if (Object.keys(merged).length === 0) {
    return null;
  }

  return merged;
}

export function deriveRulesFromDrawPlan(
  currentRules: EditionRules,
  drawPlan: EditionDrawPlan,
): EditionRules {
  if (drawPlan.groupCount === undefined) {
    return currentRules;
  }

  return {
    ...currentRules,
    minimumGroupSize: WIZARD_MIN_GROUP_SIZE,
    protectedSeedCount: drawPlan.groupCount,
  };
}

export function validateDrawPlanAgainstRegistrations(
  drawPlan: EditionDrawPlan,
  registrationCount: number,
  registrationIds: ReadonlySet<string>,
): string | null {
  const { groupCount, groupSizes, seedPlayerIds, randomSeed, approvedGroups } = drawPlan;

  if (groupCount !== undefined && groupSizes !== undefined && groupSizes.length !== groupCount) {
    return 'A quantidade de tamanhos de grupo deve corresponder ao número de grupos.';
  }

  if (groupCount !== undefined && groupSizes === undefined && registrationCount > 0) {
    try {
      partitionPlayersIntoGroups(registrationCount, groupCount);
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Distribuição de grupos inválida para o número de inscritos.';
    }
  }

  if (groupSizes !== undefined) {
    if (groupCount !== undefined && groupSizes.length !== groupCount) {
      return 'A quantidade de tamanhos de grupo deve corresponder ao número de grupos.';
    }

    if (
      registrationCount > 0 &&
      groupSizes.reduce((sum, size) => sum + size, 0) !== registrationCount
    ) {
      return 'A distribuição de grupos não corresponde ao número de inscritos.';
    }

    try {
      for (const size of groupSizes) {
        if (size < WIZARD_MIN_GROUP_SIZE) {
          throw new Error(`Group size ${size} is below minimum ${WIZARD_MIN_GROUP_SIZE}`);
        }
      }
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Tamanho de grupo inválido na configuração do sorteio.';
    }
  }

  if (seedPlayerIds !== undefined) {
    if (groupCount !== undefined && seedPlayerIds.length !== groupCount) {
      return 'O número de seeds deve ser igual ao número de grupos.';
    }

    for (const seedPlayerId of seedPlayerIds) {
      if (!registrationIds.has(seedPlayerId)) {
        return 'Um ou mais seeds não estão inscritos nesta edição.';
      }
    }
  }

  const hasApprovedPreview = randomSeed !== undefined || approvedGroups !== undefined;
  if (hasApprovedPreview) {
    if (
      groupCount === undefined ||
      groupSizes === undefined ||
      seedPlayerIds === undefined ||
      randomSeed === undefined ||
      approvedGroups === undefined
    ) {
      return 'A prévia aprovada do sorteio está incompleta.';
    }

    let generatedDraw;
    try {
      generatedDraw = executeExplicitDraw({
        playerIds: [...registrationIds],
        seedPlayerIds,
        groupSizes,
        randomSeed,
      });
    } catch (error) {
      return error instanceof Error ? error.message : 'A prévia aprovada do sorteio é inválida.';
    }

    if (!drawMatchesApprovedGroups(generatedDraw, approvedGroups)) {
      return 'Os grupos aprovados não correspondem ao sorteio reproduzido pelo servidor.';
    }
  }

  return null;
}

export function isCompleteApprovedDrawPlan(
  plan: EditionDrawPlan | null | undefined,
): plan is EditionDrawPlan & {
  groupCount: number;
  groupSizes: number[];
  seedPlayerIds: string[];
  randomSeed: string;
  approvedGroups: NonNullable<EditionDrawPlan['approvedGroups']>;
} {
  return Boolean(
    plan &&
    typeof plan.groupCount === 'number' &&
    plan.groupSizes &&
    plan.groupSizes.length > 0 &&
    plan.seedPlayerIds &&
    plan.seedPlayerIds.length > 0 &&
    plan.randomSeed?.trim() &&
    plan.approvedGroups &&
    plan.approvedGroups.length > 0,
  );
}

/** True when the request body disagrees with a field already approved on the server. */
export function drawRequestConflictsWithPersistedPlan(
  persisted: EditionDrawPlan & {
    groupCount: number;
    groupSizes: number[];
    seedPlayerIds: string[];
    randomSeed: string;
    approvedGroups: NonNullable<EditionDrawPlan['approvedGroups']>;
  },
  body: {
    groupCount?: number;
    groupSizes?: number[];
    seedPlayerIds?: string[];
    randomSeed?: string;
    approvedGroups?: NonNullable<EditionDrawPlan['approvedGroups']>;
  },
): boolean {
  if (body.groupCount !== undefined && body.groupCount !== persisted.groupCount) {
    return true;
  }
  if (
    body.groupSizes !== undefined &&
    JSON.stringify(body.groupSizes) !== JSON.stringify(persisted.groupSizes)
  ) {
    return true;
  }
  if (
    body.seedPlayerIds !== undefined &&
    JSON.stringify(body.seedPlayerIds) !== JSON.stringify(persisted.seedPlayerIds)
  ) {
    return true;
  }
  if (body.randomSeed !== undefined && body.randomSeed.trim() !== persisted.randomSeed) {
    return true;
  }
  if (
    body.approvedGroups !== undefined &&
    JSON.stringify(body.approvedGroups) !== JSON.stringify(persisted.approvedGroups)
  ) {
    return true;
  }
  return false;
}
