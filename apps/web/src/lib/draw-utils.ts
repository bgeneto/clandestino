import type { EditionDrawPlan, EditionRules } from '@clandestino/shared-contracts';
import {
  chooseGroupConfiguration,
  partitionPlayersIntoGroups,
  WIZARD_MIN_GROUP_SIZE,
} from '@clandestino/tournament-engine';

function validateExplicitDrawPlan(playerCount: number, drawPlan: EditionDrawPlan): string | null {
  const { approvedGroups, groupCount, groupSizes, randomSeed, seedPlayerIds } = drawPlan;

  if (groupCount === undefined || groupSizes === undefined) {
    return null;
  }

  if (playerCount < WIZARD_MIN_GROUP_SIZE) {
    return `São necessários ao menos ${WIZARD_MIN_GROUP_SIZE} jogadores inscritos para o sorteio. Clique em configurar edição para fazer o check-in dos jogadores.`;
  }

  try {
    const expectedSizes = partitionPlayersIntoGroups(playerCount, groupCount);
    const sizesMatch =
      groupSizes.length === expectedSizes.length &&
      groupSizes.every((size, index) => size === expectedSizes[index]);

    if (!sizesMatch || groupSizes.reduce((sum, size) => sum + size, 0) !== playerCount) {
      return `Com ${playerCount} jogadores, a configuração de ${groupCount} grupo(s) não é mais válida. Ajuste o número de grupos ou inscreva mais jogadores em Configurar edição.`;
    }
  } catch {
    return `Com ${playerCount} jogadores, não é possível formar ${groupCount} grupo(s) configurados. Ajuste o número de grupos ou inscreva mais jogadores em Configurar edição.`;
  }

  if (seedPlayerIds === undefined) {
    return 'Seeds ainda não configurados. Continue em Configurar edição.';
  }

  if (seedPlayerIds.length !== groupCount) {
    return `Selecione ${groupCount} cabeça(s) de chave em Configurar edição (atualmente ${seedPlayerIds.length}).`;
  }

  if (!randomSeed || !approvedGroups?.length) {
    return 'A prévia dos grupos ainda não foi aprovada. Conclua o sorteio em Configurar edição.';
  }

  return null;
}

function validateAutomaticDraw(playerCount: number, rules: EditionRules): string | null {
  if (playerCount < rules.minimumGroupSize) {
    return `São necessários ao menos ${rules.minimumGroupSize} jogadores inscritos para o sorteio. Clique em configurar edição para fazer o check-in dos jogadores.`;
  }

  try {
    const config = chooseGroupConfiguration(playerCount, rules);
    if (config.groupCount < 1) {
      return 'Não foi possível formar grupos com os inscritos atuais.';
    }

    if (rules.protectedSeedCount !== config.groupCount) {
      return `Configure exatamente ${config.groupCount} cabeça(s) de chave (um por grupo) em Configurar edição (atualmente ${rules.protectedSeedCount}).`;
    }

    return null;
  } catch {
    return `Número de jogadores (${playerCount}) insuficiente para formar grupos com as regras atuais.`;
  }
}

export function getDrawReadinessWarning(
  playerCount: number,
  rules: EditionRules,
  drawPlan?: EditionDrawPlan | null,
): string | null {
  if (drawPlan?.groupCount !== undefined) {
    return validateExplicitDrawPlan(playerCount, drawPlan);
  }

  return validateAutomaticDraw(playerCount, rules);
}

export function canExecuteExplicitDraw(
  drawPlan?: EditionDrawPlan | null,
): drawPlan is EditionDrawPlan & {
  groupCount: number;
  groupSizes: number[];
  seedPlayerIds: string[];
  randomSeed: string;
  approvedGroups: Array<{ playerIds: string[] }>;
} {
  return (
    drawPlan?.groupCount !== undefined &&
    drawPlan.groupSizes !== undefined &&
    drawPlan.seedPlayerIds !== undefined &&
    drawPlan.seedPlayerIds.length === drawPlan.groupCount &&
    drawPlan.randomSeed !== undefined &&
    drawPlan.approvedGroups !== undefined &&
    drawPlan.approvedGroups.length === drawPlan.groupCount
  );
}

export function resolveEffectiveDrawPlan(
  serverDrawPlan?: EditionDrawPlan | null,
  draftDrawPlan?: EditionDrawPlan | null,
): EditionDrawPlan | null {
  if (serverDrawPlan?.groupCount !== undefined) {
    return {
      ...draftDrawPlan,
      ...serverDrawPlan,
      groupCount: serverDrawPlan.groupCount ?? draftDrawPlan?.groupCount,
      groupSizes: serverDrawPlan.groupSizes ?? draftDrawPlan?.groupSizes,
      seedPlayerIds: serverDrawPlan.seedPlayerIds ?? draftDrawPlan?.seedPlayerIds,
    };
  }

  if (draftDrawPlan?.groupCount !== undefined) {
    return draftDrawPlan;
  }

  return null;
}
