import type { TournamentRules } from '@clandestino/shared-contracts';
import { chooseGroupConfiguration } from '@clandestino/tournament-engine';

export function getDrawReadinessWarning(
  playerCount: number,
  rules: TournamentRules,
): string | null {
  if (playerCount < rules.minimumGroupSize) {
    return `São necessários ao menos ${rules.minimumGroupSize} jogadores inscritos para o sorteio.`;
  }

  try {
    const config = chooseGroupConfiguration(playerCount, rules);
    if (config.groupCount < rules.protectedSeedCount) {
      return `Com ${playerCount} jogador(es), só é possível formar ${config.groupCount} grupo(s), menos que os ${rules.protectedSeedCount} configurados. Ajuste o número de grupos ou inscreva mais jogadores.`;
    }

    return null;
  } catch {
    return `Número de jogadores (${playerCount}) insuficiente para o número de grupos configurado (${rules.protectedSeedCount}).`;
  }
}
