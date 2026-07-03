import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './HomePage.js';

vi.mock('../hooks/use-player-session.js', () => ({
  usePlayerSession: () => ({
    session: null,
    isLoggedIn: false,
    clearSession: vi.fn(),
  }),
}));

vi.mock('../hooks/use-edition.js', () => ({
  useEdition: () => ({ isError: false }),
}));

vi.mock('../hooks/use-public-data.js', () => ({
  usePublicChampionships: () => ({
    data: [
      { id: 'champ-1', name: 'Clandestino 2026', archivedAt: null },
      { id: 'champ-2', name: 'Clandestino 2027', archivedAt: null },
    ],
    isLoading: false,
  }),
}));

describe('HomePage', () => {
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

  function renderHome() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <HomePage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  }

  it('lists championship cards linking to public pages without ranking or edition details', () => {
    renderHome();

    expect(container.textContent).toContain('Campeonatos');
    expect(container.textContent).toContain('Clandestino 2026');
    expect(container.textContent).toContain('Clandestino 2027');
    expect(container.textContent).not.toContain('Ranking do campeonato');
    expect(container.textContent).not.toContain('Edições ao vivo');
    expect(container.querySelector('select')).toBeNull();

    const links = Array.from(container.querySelectorAll('a')).map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(links).toContain('/campeonato/champ-1');
    expect(links).toContain('/campeonato/champ-2');
    expect(links.some((href) => href?.includes('/entrar'))).toBe(false);
    expect(links.some((href) => href?.includes('/edicao/'))).toBe(false);
    expect(container.querySelector('a[href="/organizador"]')?.textContent).toBe(
      'Organizador? Acessar painel',
    );
    expect(container.querySelector('a.rounded-lg.bg-brand[href="/organizador"]')).toBeNull();
  });
});
