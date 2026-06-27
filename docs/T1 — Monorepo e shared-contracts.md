# T1 — Monorepo e shared-contracts

## Objetivo

Inicializar o monorepo pnpm workspaces e criar o pacote `shared-contracts` com todos os tipos TypeScript e schemas TypeBox compartilhados entre `api` e `web`.

## Escopo

**Incluído:**

- Configuração do monorepo: `pnpm-workspace.yaml`, `tsconfig` base, `.gitignore`, `package.json` raiz
- Pacote `packages/shared-contracts` com:
  - Tipos: `Player`, `Season`, `Edition`, `TournamentRules`, `Group`, `Match`, `MatchStatus`, `Standing`, `FinalPlacement`, `DrawSnapshot`, `AuditEvent`
  - Enum `MatchStatus`: `AGENDADA | AGUARDANDO_CONFIRMACAO | CONFIRMADA | CONTESTADA | CORRIGIDA | CANCELADA`
  - Schemas TypeBox para validação de request/response (usados tanto na API quanto no PWA)
- Estrutura de pastas vazia para `packages/tournament-engine`, `apps/api`, `apps/web`
- Configuração de Vitest compartilhada

**Excluído:** implementação de qualquer lógica de negócio ou componente de UI

## Referências

- @c08f7f0d-4069-4916-bc47-e356d4d952f0/61be083b-ed4a-496b-af0d-1e236e80156c — Seção 3: Arquitetura de Componentes (`shared-contracts`)

## Critérios de aceitação

- `pnpm install` na raiz instala todas as dependências dos workspaces
- `packages/shared-contracts` exporta todos os tipos e schemas sem erros de TypeScript
- Outros pacotes conseguem importar de `@clandestino/shared-contracts`