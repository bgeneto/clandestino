import { describe, expect, it } from 'vitest';
import {
  canonicalizePlayerName,
  findDuplicateNormalizedPlayerName,
  normalizePlayerName,
  validatePlayerName,
} from './player.js';

describe('normalizePlayerName (chave de comparação)', () => {
  it('trims whitespace and uppercases', () => {
    expect(normalizePlayerName('  ana souza  ')).toBe('ANA SOUZA');
    expect(normalizePlayerName('lucas lima')).toBe('LUCAS LIMA');
  });

  it('collapses internal and surrounding whitespace runs into single spaces', () => {
    expect(normalizePlayerName('ana   souza')).toBe('ANA SOUZA');
    expect(normalizePlayerName('  ana  da   silva  ')).toBe('ANA DA SILVA');
    expect(normalizePlayerName('ana\tsouza\nlima')).toBe('ANA SOUZA LIMA');
  });

  it('strips every diacritic and cedilha so accented/unaccented forms collapse', () => {
    // Acentos agudos, circunflexos, til, trema, crase — todos colapsam.
    expect(normalizePlayerName('José')).toBe('JOSE');
    expect(normalizePlayerName('JOSÉ')).toBe('JOSE');
    expect(normalizePlayerName('João')).toBe('JOAO');
    expect(normalizePlayerName('JOÃO')).toBe('JOAO');
    expect(normalizePlayerName('FÁTIMA')).toBe('FATIMA');
    expect(normalizePlayerName('ÀNGELA')).toBe('ANGELA');
    expect(normalizePlayerName('JÔNATAS')).toBe('JONATAS');
    // Cedilha e til colapsam (requisito do produto: CONCEIÇÃO ≡ CONCEICAO).
    expect(normalizePlayerName('Conceição')).toBe('CONCEICAO');
    expect(normalizePlayerName('CONCEIÇÃO')).toBe('CONCEICAO');
    expect(normalizePlayerName('Niño')).toBe('NINO');
    // Caso composto do enunciado: "LUÍZ SÁLVIA" ≡ "LUIZ SALVIA".
    expect(normalizePlayerName('Luíz Sálvia')).toBe('LUIZ SALVIA');
    expect(normalizePlayerName('LUIZ SALVIA')).toBe('LUIZ SALVIA');
  });
});

describe('canonicalizePlayerName (forma persistida)', () => {
  it('preserva acentuação, cedilha e til — só normaliza whitespace e caixa', () => {
    // É a forma que vai para a coluna player.name e é exibida no app.
    expect(canonicalizePlayerName('José')).toBe('JOSÉ');
    expect(canonicalizePlayerName('josé')).toBe('JOSÉ');
    expect(canonicalizePlayerName('FÁTIMA')).toBe('FÁTIMA');
    expect(canonicalizePlayerName('Conceição')).toBe('CONCEIÇÃO');
    expect(canonicalizePlayerName('Niño')).toBe('NIÑO');
    expect(canonicalizePlayerName('  ana  da   silva  ')).toBe('ANA DA SILVA');
    expect(canonicalizePlayerName('josé sávia')).toBe('JOSÉ SÁVIA');
  });
});

describe('validatePlayerName', () => {
  it('aceita nomes com ao menos 2 caracteres e devolve a forma canônica', () => {
    expect(validatePlayerName('ab')).toEqual({ ok: true, name: 'AB' });
    expect(validatePlayerName('  Joao  ')).toEqual({ ok: true, name: 'JOAO' });
    // Acentos preservados na forma canônica.
    expect(validatePlayerName('  José  ')).toEqual({ ok: true, name: 'JOSÉ' });
    expect(validatePlayerName('FÁTIMA')).toEqual({ ok: true, name: 'FÁTIMA' });
  });

  it('rejeita nomes vazios ou com menos de 2 caracteres', () => {
    expect(validatePlayerName('')).toEqual({
      ok: false,
      error: 'Nome deve ter ao menos 2 caracteres.',
    });
    expect(validatePlayerName('   ')).toEqual({
      ok: false,
      error: 'Nome deve ter ao menos 2 caracteres.',
    });
    expect(validatePlayerName('a')).toEqual({
      ok: false,
      error: 'Nome deve ter ao menos 2 caracteres.',
    });
    expect(validatePlayerName('  a  ')).toEqual({
      ok: false,
      error: 'Nome deve ter ao menos 2 caracteres.',
    });
  });
});

describe('findDuplicateNormalizedPlayerName', () => {
  it('detecta duplicatas após trim, caixa e normalização de whitespace', () => {
    const existing = ['ANA SOUZA', 'BRUNO LIMA'];

    expect(findDuplicateNormalizedPlayerName('ana souza', existing)).toBe('ANA SOUZA');
    expect(findDuplicateNormalizedPlayerName('  Ana   Souza  ', existing)).toBe('ANA SOUZA');
    expect(findDuplicateNormalizedPlayerName('CARLA MENDES', existing)).toBeNull();
  });

  it('detecta duplicatas que diferem apenas por acentos, cedilha ou til', () => {
    // "existing" preserva acentuação — o que é retornado é o nome
    // canônico da entrada conflitante, com a grafia original.
    const existing = ['JOSE', 'JOAO', 'CONCEIÇÃO', 'JOSÉ SÁLVIA'];

    expect(findDuplicateNormalizedPlayerName('José', existing)).toBe('JOSE');
    expect(findDuplicateNormalizedPlayerName('JOSÉ', existing)).toBe('JOSE');
    expect(findDuplicateNormalizedPlayerName('João', existing)).toBe('JOAO');
    expect(findDuplicateNormalizedPlayerName('JOÃO', existing)).toBe('JOAO');
    // CONCEIÇÃO já existe, mesmo nome com ou sem cedilha é a mesma chave.
    expect(findDuplicateNormalizedPlayerName('Conceicao', existing)).toBe('CONCEIÇÃO');
    expect(findDuplicateNormalizedPlayerName('CONCEIÇÃO', existing)).toBe('CONCEIÇÃO');
    // Caso composto do enunciado: "JOSÉ SÁLVIA" ≡ "JOSE SALVIA".
    expect(findDuplicateNormalizedPlayerName('José Sálvia', existing)).toBe('JOSÉ SÁLVIA');
    expect(findDuplicateNormalizedPlayerName('JOSE SALVIA', existing)).toBe('JOSÉ SÁLVIA');
  });

  it('retorna null para nomes inválidos', () => {
    expect(findDuplicateNormalizedPlayerName('a', ['ANA SOUZA'])).toBeNull();
  });
});
