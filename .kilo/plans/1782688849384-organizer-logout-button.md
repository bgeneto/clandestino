# Plan: Organizador logout (Sair) em todas as páginas

## Problema

O botão "Sair" existe apenas na página `OrganizerDashboardPage` (`/organizador/painel`).
Nas demais páginas do organizador (`/organizador/campeonato/*`, `/organizador/edicao/*`, etc.)
não há como encerrar a sessão, obrigando o usuário a navegar de volta ao painel.

## Decisão de design

**Mover o botão "Sair" para `OrganizerLayout`.**

`OrganizerLayout` é o componente que envolve todas as rotas `/organizador/*` via `<Outlet />`.
Adicionar o botão aqui garante presença em todas as páginas do organizador sem duplicação
(nenhuma alteração necessária nos pages individuais).

Alternativas descartadas:

- **Componente footer por página** — viola DRY, exige edição em 6+ páginas
- **Logout no `AppShell` header** — exporia o botão nas páginas públicas também

## Alterações

### 1. `apps/web/src/pages/organizer/OrganizerLayout.tsx`

- Adicionar `clearSession` ao destruct de `useOrganizerSession()`
- Envolver `<Outlet />` em um container `flex min-h-screen flex-col`
- Adicionar `<footer>` com botão "Sair" abaixo do `<Outlet />`
- Remover o botão "Sair" de `OrganizerDashboardPage` (já que agora é redundante)

### 2. `apps/web/src/pages/organizer/OrganizerDashboardPage.tsx`

- Remover o bloco `<button type="button" ...>Sair</button>` (linhas 54-60)
- O botão "Sair" já estará no footer do layout

## Detalhes de implementação

```tsx
// OrganizerLayout.tsx (alterado)
import { Navigate, Outlet } from 'react-router-dom';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export type OrganizerOutletContext = {
  organizerEmail: string;
};

export function OrganizerLayout() {
  const { session, isLoading, clearSession } = useOrganizerSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Navigate to="/organizador" replace />;
  }

  const context: OrganizerOutletContext = {
    organizerEmail: session.email,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Outlet context={context} />
      <footer className="mt-auto border-t border-line py-4">
        <button
          type="button"
          onClick={() => void clearSession()}
          className="w-full rounded-lg border border-line px-4 py-2 text-sm text-muted"
        >
          Sair
        </button>
      </footer>
    </div>
  );
}
```

```diff
// OrganizerDashboardPage.tsx — remover (linhas 54-60):
- <button
-   type="button"
-   onClick={() => void clearSession()}
-   className="w-full rounded-lg border border-line px-4 py-2 text-sm text-muted"
- >
-   Sair
- </button>
```

## Validação

1. `pnpm typecheck` — verificar que não há erros de tipo
2. Navegar para `/organizador/painel` → botão "Sair" visível (mesmo lugar)
3. Navegar para `/organizador/campeonato/:id` → botão "Sair" visível no rodapé
4. Navegar para `/organizador/edicao/:id` → botão "Sair" visível no rodapé
5. Clicar "Sair" em qualquer página → redireciona para `/organizador` (login)
6. Confirmar que `pnpm typecheck` passa nos workspaces afetados

## Riscos

- O container `flex min-h-screen flex-col` + `mt-auto` no layout pode alterar o comportamento
  de padding/margin em páginas que já usam esses estilos. Verificar visualmente.
- A remoção do botão do dashboard não deve quebrar nenhum teste existente (não há testes
  mencionados para o botão de logout).
