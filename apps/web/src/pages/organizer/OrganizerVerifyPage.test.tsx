import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import {
  OrganizerVerifyPage,
  resetOrganizerVerifyAttemptsForTests,
} from './OrganizerVerifyPage.js';

const verifyOrganizerMagicLink = vi.fn();
const setSession = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/organizer-api.js', () => ({
  verifyOrganizerMagicLink: (...args: unknown[]) => verifyOrganizerMagicLink(...args),
}));

vi.mock('../../hooks/use-organizer-session.js', () => ({
  useOrganizerSession: () => ({
    isLoggedIn: false,
    isLoading: false,
    setSession,
  }),
}));

describe('OrganizerVerifyPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    verifyOrganizerMagicLink.mockReset();
    setSession.mockClear();
    resetOrganizerVerifyAttemptsForTests();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    resetOrganizerVerifyAttemptsForTests();
  });

  it('tenta validar o token uma única vez sob Strict Mode', async () => {
    verifyOrganizerMagicLink.mockImplementation(
      () =>
        new Promise(() => {
          // permanece pendente — só importa quantas vezes foi chamado
        }),
    );

    await act(async () => {
      root.render(
        <StrictMode>
          <MemoryRouter initialEntries={['/organizador/entrar?token=abc']}>
            <Routes>
              <Route path="/organizador/entrar" element={<OrganizerVerifyPage />} />
            </Routes>
          </MemoryRouter>
        </StrictMode>,
      );
    });

    expect(verifyOrganizerMagicLink).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Validando link de acesso');
  });

  it('não fica em loop após falha — mostra o erro', async () => {
    verifyOrganizerMagicLink.mockRejectedValue(
      new ApiError('Link inválido, expirado ou já utilizado.', 401),
    );

    await act(async () => {
      root.render(
        <StrictMode>
          <MemoryRouter initialEntries={['/organizador/entrar?token=used']}>
            <Routes>
              <Route path="/organizador/entrar" element={<OrganizerVerifyPage />} />
            </Routes>
          </MemoryRouter>
        </StrictMode>,
      );
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Link inválido, expirado ou já utilizado.');
      });
    });

    expect(verifyOrganizerMagicLink).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Validando link de acesso');
  });
});
