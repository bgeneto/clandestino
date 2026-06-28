import type { EditionRules, ScoringTable } from '@clandestino/shared-contracts';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, message, details);
}

export function unauthorized(message = 'Autenticação de organizador necessária.'): ApiError {
  return new ApiError(401, message);
}

export function forbidden(message = 'Acesso negado.'): ApiError {
  return new ApiError(403, message);
}

export function notFound(message: string): ApiError {
  return new ApiError(404, message);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(409, message, details);
}

export function unprocessableEntity(message: string, details?: unknown): ApiError {
  return new ApiError(422, message, details);
}

export function validateEditionRules(rules: EditionRules): string | null {
  if (rules.minimumGroupSize > rules.preferredGroupSize) {
    return 'minimumGroupSize não pode ser maior que preferredGroupSize.';
  }

  if (rules.preferredGroupSize > rules.maximumGroupSize) {
    return 'preferredGroupSize não pode ser maior que maximumGroupSize.';
  }

  if (rules.minimumGroupSize > rules.maximumGroupSize) {
    return 'minimumGroupSize não pode ser maior que maximumGroupSize.';
  }

  if (rules.protectedSeedCount < 0) {
    return 'protectedSeedCount não pode ser negativo.';
  }

  if (rules.groupRankingCriteria.length === 0) {
    return 'groupRankingCriteria deve conter ao menos um critério.';
  }

  return null;
}

/** @deprecated Use validateEditionRules */
export const validateTournamentRules = validateEditionRules;

export function validateScoringTable(scoringTable: ScoringTable): string | null {
  const positions = new Set<number>();

  for (const [index, entry] of scoringTable.entries()) {
    if (entry.position < 1) {
      return `Entrada ${index + 1} da tabela de pontuação possui posição inválida.`;
    }

    if (positions.has(entry.position)) {
      return `A posição ${entry.position} aparece mais de uma vez na tabela de pontuação.`;
    }

    positions.add(entry.position);

    if (entry.points < 0) {
      return `A posição ${entry.position} possui pontuação negativa.`;
    }
  }

  return null;
}
