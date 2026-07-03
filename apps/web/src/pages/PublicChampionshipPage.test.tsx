import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicChampionshipPage } from './PublicChampionshipPage.js';

vi.mock('../hooks/use-public-data.js', () => ({
  usePublicChampionship: () => ({
    data: {
      id: 'champ-1',
      name: 'Clandestino 2026',
      scoringTable: {},
      createdAt: '2026-01-01T12:00:00.000Z',
    },
    isLoading: false,
    isError: false,
  }),
  usePublicChampionshipEditions: () => ({
    data: [
      {
        id: 'ed-live',
        championshipId: 'champ-1',
        name: 'Edição Março',
        date: '2026-03-01',
        status: 'EM_ANDAMENTO',
        createdAt: '2026-01-01T12:00:00.000Z',
      },
      {
        id: 'ed-done',
        championshipId: 'champ-1',
        name: 'Edição Fevereiro',
        date: '2026-02-01',
        status: 'ENCERRADA',
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    ],
    isLoading: false,
  }),
  usePublicChampionshipRanking: () => ({
    data: [
      { playerId: 'p1', playerName: 'João', rank: 1, accumulatedPoints: 10 },
      { playerId: 'p2', playerName: 'Maria', rank: 2, accumulatedPoints: 8 },
    ],
    isLoading: false,
  }),
}));

vi.mock('../components/public/LiveEditionCard.js', () => ({
  LiveEditionCard: ({ edition }: { edition: { id: string; name: string } }) => (
    <div data-testid={`live-card-${edition.id}`}>{edition.name}</div>
  ),
}));

describe('PublicChampionshipPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/campeonato/champ-1']}>
            <Routes>
              <Route path="/campeonato/:championshipId" element={<PublicChampionshipPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  }

  it('renders live previews, full ranking and edition lists with public edition links', () => {
    renderPage();

    expect(container.textContent).toContain('Clandestino 2026');
    expect(container.textContent).toContain('Edições ao vivo');
    expect(container.querySelector('[data-testid="live-card-ed-live"]')).not.toBeNull();
    expect(container.textContent).toContain('João');
    expect(container.textContent).toContain('Maria');
    expect(container.textContent).toContain('Ao vivo');
    expect(container.textContent).toContain('Encerradas');

    const links = Array.from(container.querySelectorAll('a')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(links).toContain('/');
    expect(links).toContain('/edicao/ed-live');
    expect(links).toContain('/edicao/ed-done');
    expect(links.some((href) => href?.includes('/entrar'))).toBe(false);
  });
});
