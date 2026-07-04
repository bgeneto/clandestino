import type { EditionDrawPlan, EditionRules } from '@clandestino/shared-contracts';
import { partitionPlayersIntoGroups, WIZARD_MIN_GROUP_SIZE } from '@clandestino/tournament-engine';

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
  const { groupCount, groupSizes, seedPlayerIds } = drawPlan;

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

  return null;
}
