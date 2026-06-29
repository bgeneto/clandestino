import { describe, expect, it } from 'vitest';
import { formatEditionStatus } from './format.js';

describe('formatEditionStatus', () => {
  it('uses default labels', () => {
    expect(formatEditionStatus('EM_ANDAMENTO')).toBe('Em andamento');
    expect(formatEditionStatus('FASE_COLOCACAO')).toBe('Fase de colocação');
  });

  it('clarifies single-group placement-ready state', () => {
    expect(formatEditionStatus('FASE_COLOCACAO', { placementGroupCount: 0 })).toBe(
      'Grupos encerrados — pronto para finalizar',
    );
  });

  it('keeps placement label when groups exist', () => {
    expect(formatEditionStatus('FASE_COLOCACAO', { placementGroupCount: 2 })).toBe(
      'Fase de colocação',
    );
  });
});
