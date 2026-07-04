import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

export const PLAYER_NAME_MIN_LENGTH = 2;
export const PLAYER_NAME_MAX_LENGTH = 120;

/**
 * Mapa de caracteres acentuados pré-compostos para sua base ASCII, usado
 * **apenas** como chave de comparação de duplicatas (não mexe no nome
 * armazenado).
 *
 * Inclui letras com cedilha (Ç → C) e tilde (Ñ → N) porque o requisito
 * de produto é que `FÁTIMA` ≡ `FATIMA`, `CONCEIÇÃO` ≡ `CONCEICAO` e
 * `JOSÉ` ≡ `JOSE` sejam tratados como o mesmo jogador.
 *
 * Gera:
 * - `JOSÉ` → `JOSE`, `JOÃO` → `JOAO`, `FÁTIMA` → `FATIMA`,
 *   `CONCEIÇÃO` → `CONCEICAO`, `NIÑO` → `NINO`, `JOSE SÁLVIA` → `JOSE SALVIA`.
 */
const DIACRITIC_TO_BASE: Record<string, string> = {
  Á: 'A',
  À: 'A',
  Ã: 'A',
  Â: 'A',
  Ä: 'A',
  É: 'E',
  È: 'E',
  Ê: 'E',
  Ë: 'E',
  Í: 'I',
  Ì: 'I',
  Î: 'I',
  Ï: 'I',
  Ó: 'O',
  Ò: 'O',
  Õ: 'O',
  Ô: 'O',
  Ö: 'O',
  Ú: 'U',
  Ù: 'U',
  Û: 'U',
  Ü: 'U',
  Ý: 'Y',
  Ÿ: 'Y',
  Ç: 'C',
  Ñ: 'N',
};

const DIACRITIC_TO_BASE_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(DIACRITIC_TO_BASE).map(([upper, base]) => [
    upper.toLocaleLowerCase('pt-BR'),
    base.toLocaleLowerCase('pt-BR'),
  ]),
);

const DIACRITIC_STRIP_RE = new RegExp(
  `[${Object.keys(DIACRITIC_TO_BASE).join('')}${Object.keys(DIACRITIC_TO_BASE_LOWER).join('')}]`,
  'g',
);

/**
 * Chave de comparação de duplicatas de nome de jogador.
 *
 * Aplica `trim`, colapsa whitespace, caixa alta e remove **todos** os
 * diacríticos/cedilhas (`Á/À/Ã/Â/Ä` → `A`, `Ç` → `C`, `Ñ` → `N`, etc.).
 *
 * Esta função é puramente uma **chave de comparação** — o nome armazenado
 * na coluna `player.name` continua preservando acentuação original
 * (ex.: `JOSÉ` continua sendo gravado como `JOSÉ`).
 *
 * Por isso:
 * - `normalizePlayerName('JOSÉ')`  → `'JOSE'`
 * - `normalizePlayerName('FÁTIMA')` → `'FATIMA'`
 * - `normalizePlayerName('José')`   → `'JOSE'`
 * - `normalizePlayerName('  ana  da   silva ')` → `'ANA DA SILVA'`
 *
 * Usado em `findDuplicateNormalizedPlayerName`, `findPlayerByNormalizedName`
 * e `findOrCreatePlayerByName` para detectar que dois nomes com grafias
 * diferentes se referem ao mesmo jogador.
 */
export function normalizePlayerName(name: string): string {
  return name
    .replace(
      DIACRITIC_STRIP_RE,
      (char) => DIACRITIC_TO_BASE[char] ?? DIACRITIC_TO_BASE_LOWER[char] ?? char,
    )
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR');
}

/**
 * Forma canônica do nome de jogador **preservando acentuação original**.
 *
 * Aplica apenas `trim`, colapso de whitespace e caixa alta via
 * `toLocaleUpperCase('pt-BR')` — **não** remove acentos nem cedilha.
 *
 * É o que vai persistido na coluna `player.name` e o que é retornado
 * nas respostas da API e exibido no PWA, preservando exatamente o que
 * o usuário digitou (em maiúsculas, normalizado em whitespace).
 *
 * Exemplos:
 * - `canonicalizePlayerName('José')`    → `'JOSÉ'`
 * - `canonicalizePlayerName('FÁTIMA')`  → `'FÁTIMA'`
 * - `canonicalizePlayerName('Conceição')` → `'CONCEIÇÃO'`
 */
export function canonicalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export type PlayerNameValidationResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Valida o nome e retorna a forma canônica (preservando acentuação).
 *
 * A validação de comprimento (`PLAYER_NAME_MIN_LENGTH`/`MAX`) é feita sobre
 * a **forma canônica**, que tem o mesmo número de caracteres do input após
 * `trim`/`collapse` (acentos são 1 caractere cada, mantidos como vieram).
 */
export function validatePlayerName(name: string): PlayerNameValidationResult {
  const canonical = canonicalizePlayerName(name);

  if (canonical.length < PLAYER_NAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `Nome deve ter ao menos ${PLAYER_NAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (canonical.length > PLAYER_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Nome deve ter no máximo ${PLAYER_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, name: canonical };
}

export const PLAYER_NAME_DUPLICATE_MESSAGE = 'Já existe um jogador com este nome.';

/**
 * Retorna o nome canônico conflitante quando `candidateName` duplica
 * alguma entrada em `existingNames`. A comparação é feita via
 * `normalizePlayerName` (chave sem acentos), mas o valor retornado é o
 * **nome canônico preservando acentos** da entrada que colidiu (para
 * feedback ao usuário do tipo "Já existe: JOSÉ").
 */
export function findDuplicateNormalizedPlayerName(
  candidateName: string,
  existingNames: readonly string[],
): string | null {
  const validation = validatePlayerName(candidateName);
  if (!validation.ok) {
    return null;
  }

  const candidateKey = normalizePlayerName(validation.name);
  for (const existing of existingNames) {
    if (normalizePlayerName(existing) === candidateKey) {
      return canonicalizePlayerName(existing);
    }
  }

  return null;
}

export const PlayerSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: PLAYER_NAME_MIN_LENGTH, maxLength: PLAYER_NAME_MAX_LENGTH }),
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'Player' },
);

export type Player = Static<typeof PlayerSchema>;

export const CreatePlayerBodySchema = Type.Object(
  {
    name: Type.String({ minLength: PLAYER_NAME_MIN_LENGTH, maxLength: PLAYER_NAME_MAX_LENGTH }),
  },
  { $id: 'CreatePlayerBody' },
);

export type CreatePlayerBody = Static<typeof CreatePlayerBodySchema>;

export const UpdatePlayerBodySchema = Type.Object(
  {
    name: Type.String({ minLength: PLAYER_NAME_MIN_LENGTH, maxLength: PLAYER_NAME_MAX_LENGTH }),
  },
  { $id: 'UpdatePlayerBody' },
);

export type UpdatePlayerBody = Static<typeof UpdatePlayerBodySchema>;

export const DeletePlayerResponseSchema = Type.Object(
  {
    id: UuidSchema,
    deletedAt: IsoDateTimeSchema,
  },
  { $id: 'DeletePlayerResponse' },
);

export type DeletePlayerResponse = Static<typeof DeletePlayerResponseSchema>;

export const PlayerListResponseSchema = Type.Object(
  {
    players: Type.Array(PlayerSchema),
  },
  { $id: 'PlayerListResponse' },
);

export type PlayerListResponse = Static<typeof PlayerListResponseSchema>;
