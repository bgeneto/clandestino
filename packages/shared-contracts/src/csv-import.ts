export type ImportScoresCsvColumnIndexes = {
  playerNameIndex: number;
  accumulatedPointsIndex: number;
};

type RequiredColumn = 'player_name' | 'accumulated_points';

const HEADER_ALIASES: Record<string, RequiredColumn> = {
  player_name: 'player_name',
  nome: 'player_name',
  accumulated_points: 'accumulated_points',
  pontuacao: 'accumulated_points',
  pontos: 'accumulated_points',
};

export const IMPORT_SCORES_CSV_FORMAT_HINT =
  'Nome (ou player_name) e Pontuação (ou accumulated_points)';

export function normalizeCsvHeader(header: string): string {
  return header.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function resolveImportScoresCsvColumns(headers: string[]): ImportScoresCsvColumnIndexes {
  const mapping = new Map<RequiredColumn, number>();

  for (let index = 0; index < headers.length; index++) {
    const raw = headers[index]?.trim();
    if (!raw) {
      continue;
    }

    const canonical = HEADER_ALIASES[normalizeCsvHeader(raw)];
    if (!canonical) {
      continue;
    }
    if (mapping.has(canonical)) {
      throw new Error(`Cabeçalho inválido. Coluna duplicada: ${raw}.`);
    }
    mapping.set(canonical, index);
  }

  const playerNameIndex = mapping.get('player_name');
  const accumulatedPointsIndex = mapping.get('accumulated_points');

  if (playerNameIndex === undefined || accumulatedPointsIndex === undefined) {
    throw new Error(`Cabeçalho inválido. Colunas obrigatórias: ${IMPORT_SCORES_CSV_FORMAT_HINT}.`);
  }

  return { playerNameIndex, accumulatedPointsIndex };
}
