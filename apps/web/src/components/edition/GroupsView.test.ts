import { describe, expect, it } from 'vitest';
import { getGroupsViewEmptyMessage } from './GroupsView.js';

describe('getGroupsViewEmptyMessage', () => {
  it('returns draw-specific message', () => {
    expect(getGroupsViewEmptyMessage('draw')).toBe('Sorteio ainda não publicado.');
  });

  it('returns placement-specific message', () => {
    expect(getGroupsViewEmptyMessage('placement')).toBe('Nenhum grupo de colocação.');
  });

  it('returns generic message by default', () => {
    expect(getGroupsViewEmptyMessage()).toBe('Grupos ainda não publicados.');
    expect(getGroupsViewEmptyMessage('generic')).toBe('Grupos ainda não publicados.');
  });
});
