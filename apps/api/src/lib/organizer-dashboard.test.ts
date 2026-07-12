import type { EditionStatus } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import {
  deriveOrganizerEditionAction,
  sortOrganizerActiveEditions,
} from './organizer-dashboard.js';

function edition(
  overrides: Partial<{
    id: string;
    championshipId: string;
    championshipName: string;
    name: string;
    date: string;
    status: EditionStatus;
    contestedMatchCount: number;
    placementGroupCount: number;
    needsOrganizerAction: boolean;
    actionLabel: string | null;
  }> = {},
) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    championshipId: '00000000-0000-4000-8000-000000000010',
    championshipName: 'Campeonato',
    name: 'Clandestino #1',
    date: '2026-07-04',
    status: 'EM_ANDAMENTO' as EditionStatus,
    contestedMatchCount: 0,
    placementGroupCount: 0,
    needsOrganizerAction: false,
    actionLabel: null,
    ...overrides,
  };
}

describe('deriveOrganizerEditionAction', () => {
  it('prioritizes contested matches over status', () => {
    expect(
      deriveOrganizerEditionAction({
        status: 'EM_ANDAMENTO',
        contestedMatchCount: 1,
        pendingMatchCount: 2,
        placementGroupCount: 0,
      }),
    ).toEqual({
      needsOrganizerAction: true,
      actionLabel: 'Resolver contestação',
    });
  });

  it('prioritizes pending results over status', () => {
    expect(
      deriveOrganizerEditionAction({
        status: 'EM_ANDAMENTO',
        contestedMatchCount: 0,
        pendingMatchCount: 2,
        placementGroupCount: 0,
      }),
    ).toEqual({
      needsOrganizerAction: true,
      actionLabel: 'Resultados',
    });
  });

  it('maps setup statuses to configure action', () => {
    for (const status of ['RASCUNHO', 'INSCRICOES_ABERTAS'] as const) {
      expect(
        deriveOrganizerEditionAction({
          status,
          contestedMatchCount: 0,
          pendingMatchCount: 0,
          placementGroupCount: 0,
        }),
      ).toEqual({
        needsOrganizerAction: true,
        actionLabel: 'Configurar edição',
      });
    }
  });

  it('maps sorteio publicado to generate matches', () => {
    expect(
      deriveOrganizerEditionAction({
        status: 'SORTEIO_PUBLICADO',
        contestedMatchCount: 0,
        pendingMatchCount: 0,
        placementGroupCount: 0,
      }),
    ).toEqual({
      needsOrganizerAction: true,
      actionLabel: 'Gerar partidas',
    });
  });

  it('maps placement phase with and without placement groups', () => {
    expect(
      deriveOrganizerEditionAction({
        status: 'FASE_COLOCACAO',
        contestedMatchCount: 0,
        pendingMatchCount: 0,
        placementGroupCount: 2,
      }),
    ).toEqual({
      needsOrganizerAction: true,
      actionLabel: 'Publicar fase de colocação',
    });

    expect(
      deriveOrganizerEditionAction({
        status: 'FASE_COLOCACAO',
        contestedMatchCount: 0,
        pendingMatchCount: 0,
        placementGroupCount: 0,
      }),
    ).toEqual({
      needsOrganizerAction: true,
      actionLabel: 'Encerrar edição',
    });
  });

  it('keeps in-progress editions informational when there is no contest', () => {
    expect(
      deriveOrganizerEditionAction({
        status: 'EM_ANDAMENTO',
        contestedMatchCount: 0,
        pendingMatchCount: 0,
        placementGroupCount: 0,
      }),
    ).toEqual({
      needsOrganizerAction: false,
      actionLabel: null,
    });
  });
});

describe('sortOrganizerActiveEditions', () => {
  it('orders action-required editions first, then by date desc', () => {
    const sorted = sortOrganizerActiveEditions([
      edition({
        id: '1',
        name: 'Older idle',
        date: '2026-07-01',
        status: 'EM_ANDAMENTO',
      }),
      edition({
        id: '2',
        name: 'Recent action',
        date: '2026-07-04',
        status: 'FASE_COLOCACAO',
        needsOrganizerAction: true,
        actionLabel: 'Encerrar edição',
      }),
      edition({
        id: '3',
        name: 'Older action',
        date: '2026-07-02',
        status: 'SORTEIO_PUBLICADO',
        needsOrganizerAction: true,
        actionLabel: 'Gerar partidas',
      }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['2', '3', '1']);
  });
});
