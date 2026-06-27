# AGENTS.md — Guia para agentes de IA

Este arquivo orienta agentes de código (Cursor, Copilot, etc.) a trabalhar no repositório **Clandestino** de forma consistente com a arquitetura e as regras de negócio já definidas.

## Visão geral

**Clandestino** é um PWA para o campeonato semanal de tênis de mesa da FitPong. O MVP cobre o ciclo completo de uma edição: inscrições, sorteio, partidas, confirmação de resultados, fase de colocação e ranking acumulado.

Leia antes de implementar:

- [docs/Epic Brief — Clandestino.md](docs/Epic%20Brief%20—%20Clandestino.md) — escopo e decisões de produto
- [docs/Tech Plan — Clandestino.md](docs/Tech%20Plan%20—%20Clandestino.md) — arquitetura e responsabilidades
- [docs/Core Flows — Clandestino.md](docs/Core%20Flows%20—%20Clandestino.md) — fluxos de usuário

## Arquitetura (não negociável)

```
packages/
  shared-contracts/    ← tipos TypeScript + schemas TypeBox (api ↔ web)
  tournament-engine/   ← lógica pura de torneio (zero I/O, zero HTTP, zero DB)
apps/
  api/                 ← Fastify + Drizzle + PostgreSQL (fonte da verdade)
  web/                 ← React + Vite + PWA (cliente; offline via IndexedDB)
```

### Princípios

1. **Lógica de torneio só em `tournament-engine`.** Sorteio, validação de placar, desempate e classificação vivem em funções puras exportadas por `@clandestino/tournament-engine`. A API orquestra I/O; não reimplementa regras inline em rotas.

2. **Servidor é a fonte da verdade para classificação.** `standing` e colocação final são recalculados no servidor a cada confirmação. O cliente exibe e cacheia; nunca publica classificação oficial.

3. **Contratos compartilhados em `shared-contracts`.** Tipos de domínio (`Player`, `Edition`, `Match`, `TournamentRules`, etc.) e schemas TypeBox de request/response pertencem a `@clandestino/shared-contracts`. API e web importam daqui — não duplique tipos entre apps.

4. **Validação em duas camadas.** `tournament-engine` valida regras de domínio (ex.: placar impossível). Fastify + TypeBox valida formato de entrada/saída HTTP. PostgreSQL + constraints Drizzle impede estados inválidos persistidos.

5. **Regras configuráveis por edição.** Não codifique limiares fixos (“acima de 24 jogadores, melhor de 3”) em código de rota. Use `TournamentRules` / `edition.rules` (jsonb).

6. **Determinismo auditável no sorteio.** Sorteios usam semente reproduzível (`random_seed` em `draw_snapshot`). Mesma entrada + mesma semente → mesmo resultado.

## Mapa de pacotes

### `@clandestino/shared-contracts`

- Exporta tipos e `*Schema` TypeBox por entidade (`player.ts`, `edition.ts`, `match.ts`, …).
- `DEFAULT_TOURNAMENT_RULES`, `DEFAULT_SCORING_TABLE`, `DEFAULT_GROUP_RANKING_CRITERIA` são defaults de produto — use-os, não invente valores paralelos.
- Ao adicionar campo em contrato: atualize schema TypeBox, tipos exportados em `index.ts` e consumidores (API mappers, testes).

### `@clandestino/tournament-engine`

Funções puras (referência em `packages/tournament-engine/src/index.ts`):

| Função | Responsabilidade |
|--------|------------------|
| `chooseGroupConfiguration` | Número e tamanho dos grupos |
| `allocateSeededPlayers` | Distribui seeds (1 por grupo) |
| `drawUnseededPlayers` | Sorteia demais jogadores |
| `generateGroupMatches` | Round-robin do grupo |
| `validateMatchResult` | Rejeita placares impossíveis |
| `calculateGroupStanding` | Classificação do grupo |
| `resolveTies` | Desempate: sets → saldo → vitórias |
| `generatePlacementStage` | Fase de colocação |
| `calculateFinalStanding` | Colocação final da edição |

**Testes:** Vitest + `fast-check`. Ao alterar lógica, mantenha ou adicione propriedades invariantes (ex.: “nenhum grupo com dois seeds”, “placar inválido sempre rejeitado”).

### `@clandestino/api`

Estrutura:

```
apps/api/src/
  app.ts              # createApp, plugins, registro de rotas
  server.ts           # bootstrap
  config.ts           # env vars
  db/schema.ts        # Drizzle — constraints refletem regras de integridade
  routes/             # um arquivo por área (core, editions, edition-draw, …)
  plugins/            # auth, db, config
  lib/                # mappers, csv, crypto, errors, draw (orquestra engine)
```

**Padrões da API:**

- Rotas usam `TypeBoxTypeProvider` e schemas de `shared-contracts` em `schema.body` / `schema.response`.
- Erros de domínio: lance `ApiError` via helpers em `lib/errors.ts` (`badRequest`, `notFound`, `conflict`, …).
- Mapeamento DB ↔ contrato: `lib/mappers.ts` — mantenha transformações centralizadas.
- Rotas de organizador: `preHandler: app.requireOrganizer`.
- Migrações em `apps/api/drizzle/` — gere com `db:generate`, nunca edite SQL manualmente sem motivo.

### `@clandestino/web`

Ainda em stub (`apps/web/src/index.ts`). Quando implementar (T8–T10):

- React + Vite + Tailwind + shadcn/ui
- TanStack Query para dados remotos; invalidação via SSE
- Dexie/IndexedDB para cache da edição ativa e fila offline
- Sessão do jogador: `player_id` + `edition_id` no IndexedDB (sem JWT no MVP)

## Convenções de código

### TypeScript

- `strict: true`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true` (ver `tsconfig.base.json`).
- ESM com extensão `.js` nos imports relativos (`import { x } from './foo.js'`).
- `type` imports para tipos (`import type { … }`).

### Estilo

- Mudanças focadas — não refatore áreas não relacionadas à tarefa.
- Comentários só para lógica não óbvia; nomes claros em português para domínio (mensagens de erro, logs) e inglês para código (funções, tipos técnicos).
- Reutilize funções existentes do `tournament-engine` e mappers da API.

### Testes

```bash
pnpm test                    # raiz: shared-contracts + tournament-engine
pnpm --filter @clandestino/api test
pnpm --filter @clandestino/tournament-engine test
```

- Lógica de torneio: prefira property-based (`fast-check`) para invariantes.
- API: testes de integração/unit em `apps/api/src/**/*.test.ts`.
- Não adicione testes triviais que só repetem o compilador.

### Build e typecheck

```bash
pnpm install
pnpm build
pnpm typecheck
```

Ordem de dependência: `shared-contracts` → `tournament-engine` → `api` / `web`.

## Regras de negócio críticas

| Tópico | Regra |
|--------|-------|
| Desempate | sets ganhos → saldo de sets → partidas vencidas |
| Seeds | exatamente 1 por grupo; do ranking acumulado |
| Confirmação | adversário confirma; contestação → organizador |
| Auto-confirmação | job no Fastify (`setInterval`), configurável por edição |
| Match status | `AGENDADA \| AGUARDANDO_CONFIRMACAO \| CONFIRMADA \| CONTESTADA \| CORRIGIDA \| CANCELADA` |
| Integridade DB | um jogador por grupo/edição; sem partida duplicada na mesma fase; sem classificação final duplicada |

## O que **não** fazer

- Colocar algoritmo de sorteio ou desempate diretamente em handlers Fastify.
- Calcular ou persistir `standing` oficial no cliente.
- Duplicar tipos/schemas fora de `shared-contracts`.
- Adicionar dependência de runtime (DB, fetch) em `tournament-engine`.
- Ignorar constraints do schema Drizzle ao inserir dados.
- Expandir escopo do MVP (push, multi-academia, export CSV) sem tarefa explícita.
- Criar commits ou PRs a menos que o usuário peça.

## Ambiente de desenvolvimento

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/clandestino"
pnpm --filter @clandestino/api db:migrate
pnpm --filter @clandestino/api dev
```

`DATABASE_URL` é obrigatória. Em dev, `EXPOSE_MAGIC_LINKS` (padrão fora de produção) inclui o magic link na resposta JSON para testes sem e-mail.

## Tarefas de implementação (docs/T*.md)

| Tarefa | Pacote | Status |
|--------|--------|--------|
| T1 — Monorepo e shared-contracts | `shared-contracts` | Concluído |
| T2 — tournament-engine | `tournament-engine` | Concluído |
| T3+ — API (schema, rotas, jobs, SSE) | `api` | Em andamento |
| T8–T10 — Web PWA | `web` | Pendente |

Ao pegar uma tarefa, leia o arquivo `docs/T*.md` correspondente e respeite critérios de aceitação e exclusões de escopo.

## Checklist antes de encerrar uma mudança

- [ ] Lógica de torneio permanece em `tournament-engine` (se aplicável)
- [ ] Schemas/tipos atualizados em `shared-contracts` (se contrato mudou)
- [ ] `pnpm typecheck` passa nos pacotes afetados
- [ ] `pnpm test` passa nos pacotes afetados
- [ ] Migração Drizzle gerada se `schema.ts` mudou
- [ ] Sem secrets em código ou commits (`.env` está no `.gitignore`)
- [ ] Diff mínimo e alinhado ao pedido do usuário

## Referência rápida de documentação

| Preciso de… | Onde olhar |
|-------------|------------|
| Escopo do MVP | `docs/Epic Brief — Clandestino.md` |
| Modelo de dados / SSE / offline | `docs/Tech Plan — Clandestino.md` |
| Fluxos de tela | `docs/Core Flows — Clandestino.md` |
| Critérios de uma tarefa | `docs/T1 — …`, `docs/T2 — …` |
| Schema do banco | `apps/api/src/db/schema.ts` |
| Env vars | `apps/api/src/config.ts` |
| Setup humano | `README.md` |
