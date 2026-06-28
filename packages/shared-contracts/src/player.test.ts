import { describe, expect, it } from 'vitest';
import { normalizePlayerName, validatePlayerName } from './player.js';

describe('normalizePlayerName', () => {
  it('trims whitespace and uppercases', () => {
    expect(normalizePlayerName('  ana souza  ')).toBe('ANA SOUZA');
    expect(normalizePlayerName('lucas lima')).toBe('LUCAS LIMA');
    expect(normalizePlayerName('FÁTIMA')).toBe('FÁTIMA');
  });

  it('collapses internal and surrounding whitespace runs into single spaces', () => {
    expect(normalizePlayerName('ana   souza')).toBe('ANA SOUZA');
    expect(normalizePlayerName('  ana  da   silva  ')).toBe('ANA DA SILVA');
    expect(normalizePlayerName('ana\tsouza\nlima')).toBe('ANA SOUZA LIMA');
  });
});

describe('validatePlayerName', () => {
  it('accepts names with at least 2 characters after normalization', () => {
    expect(validatePlayerName('ab')).toEqual({ ok: true, name: 'AB' });
    expect(validatePlayerName('  João  ')).toEqual({ ok: true, name: 'JOÃO' });
  });

  it('rejects empty or too-short names', () => {
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
