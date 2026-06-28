import {
  resolveImportScoresCsvColumns,
  validatePlayerName,
  type ImportScoresCsvRow,
} from '@clandestino/shared-contracts';
import { badRequest } from './errors.js';

export type ParsedCsvRow = ImportScoresCsvRow & { lineNumber: number };

export function parseImportScoresCsv(content: string): ParsedCsvRow[] {
  const normalized = content.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    throw badRequest('O arquivo CSV está vazio.');
  }

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw badRequest('O arquivo CSV deve conter cabeçalho e ao menos uma linha de dados.');
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw badRequest('O arquivo CSV está sem cabeçalho.');
  }

  const headers = parseCsvLine(headerLine).map((header) => header.trim());
  let columnIndexes;
  try {
    columnIndexes = resolveImportScoresCsvColumns(headers);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'Cabeçalho inválido.');
  }

  const rows: ParsedCsvRow[] = [];
  const seenPlayers = new Map<string, number>();

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const lineNumber = index + 1;
    const values = parseCsvLine(line);

    if (values.length !== headers.length) {
      throw badRequest(
        `Linha ${lineNumber}: número de colunas (${values.length}) diferente do cabeçalho (${headers.length}).`,
      );
    }

    const rawPlayerName = values[columnIndexes.playerNameIndex] ?? '';
    const pointsRaw = (values[columnIndexes.accumulatedPointsIndex] ?? '').trim();

    if (!rawPlayerName.trim()) {
      throw badRequest(`Linha ${lineNumber}: Nome é obrigatório.`);
    }

    const nameValidation = validatePlayerName(rawPlayerName);
    if (!nameValidation.ok) {
      throw badRequest(`Linha ${lineNumber}: ${nameValidation.error}`);
    }

    const playerName = nameValidation.name;

    if (!/^-?\d+$/.test(pointsRaw)) {
      throw badRequest(`Linha ${lineNumber}: Pontuação deve ser um número inteiro não negativo.`);
    }

    const accumulatedPoints = Number.parseInt(pointsRaw, 10);
    if (accumulatedPoints < 0) {
      throw badRequest(`Linha ${lineNumber}: Pontuação deve ser um número inteiro não negativo.`);
    }

    const normalizedName = playerName;
    const previousLine = seenPlayers.get(normalizedName);
    if (previousLine !== undefined) {
      throw badRequest(
        `Linha ${lineNumber}: jogador "${playerName}" já aparece na linha ${previousLine}.`,
      );
    }

    seenPlayers.set(normalizedName, lineNumber);
    rows.push({ playerName, accumulatedPoints, lineNumber });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index++;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
