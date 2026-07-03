import { describe, expect, it } from 'vitest';
import type { EditionSummary } from '@clandestino/shared-contracts';
import {
  filterPublishedEditions,
  isLiveEdition,
  isPublishedEdition,
  partitionPublishedEditions,
} from './public-editions.js';

function edition(status: EditionSummary['status'], id: string): EditionSummary {
  return {
    id,
    championshipId: 'champ-1',
    name: `Edição ${id}`,
    date: '2026-03-01',
    status,
    createdAt: '2026-01-01T12:00:00.000Z',
  };
}

describe('public-editions', () => {
  it('hides rascunho from published editions', () => {
    const editions = [edition('RASCUNHO', 'draft'), edition('ENCERRADA', 'done')];
    expect(filterPublishedEditions(editions).map((entry) => entry.id)).toEqual(['done']);
    expect(isPublishedEdition('RASCUNHO')).toBe(false);
    expect(isPublishedEdition('ENCERRADA')).toBe(true);
  });

  it('identifies live edition statuses', () => {
    expect(isLiveEdition('EM_ANDAMENTO')).toBe(true);
    expect(isLiveEdition('ENCERRADA')).toBe(false);
  });

  it('partitions published editions into live and finished', () => {
    const editions = [
      edition('RASCUNHO', 'draft'),
      edition('EM_ANDAMENTO', 'live'),
      edition('ENCERRADA', 'done'),
    ];

    const { live, finished } = partitionPublishedEditions(editions);
    expect(live.map((entry) => entry.id)).toEqual(['live']);
    expect(finished.map((entry) => entry.id)).toEqual(['done']);
  });
});
