# AGENTS.md — Guia para agentes de IA

Este arquivo orienta agentes de código (Cursor, Copilot, etc.) a trabalhar no repositório **Clandestino** de forma consistente com a arquitetura e as regras de negócio já definidas.

## Visão geral

**Clandestino** é um PWA para o campeonato de tênis de mesa da FitPong. O MVP cobre o ciclo completo de uma edição: inscrições, sorteio, partidas, confirmação de resultados, fase de colocação e ranking atual.

Leia [docs/domain-taxonomy.md](docs/domain-taxonomy.md) para a taxonomia canônica (Championship, Edition, EditionRules).

Leia antes de implementar:

- [Epic Brief — Clandestino.md](.agents/specs/Epic_Brief_—_Clandestino.md) — escopo e decisões de produto
- [Tech Plan — Clandestino.md](.agents/specs/Tech_Plan_—_Clandestino.md) — arquitetura e responsabilidades
- [Core Flows — Clandestino.md](.agents/specs/Core_Flows_—_Clandestino.md) — fluxos de usuário

## Arquitetura (não negociável)

```
packages/
  shared-contracts/    ← tipos TypeScript + schemas TypeBox (api ↔ web)
  tournament-engine/   ← lógica pura de torneio (zero I/O, zero HTTP, zero DB)
apps/
  api/                 ← Fastify + Drizzle + SQLite (fonte da verdade)
  web/                 ← React + Vite + PWA (cliente; offline via IndexedDB)
```

### Princípios

1. **Lógica de torneio só em `tournament-engine`.** Sorteio, validação de placar, desempate e classificação vivem em funções puras exportadas por `@clandestino/tournament-engine`. A API orquestra I/O; não reimplementa regras inline em rotas.

2. **Servidor é a fonte da verdade para classificação.** `standing` e colocação final são recalculados no servidor a cada confirmação. O cliente exibe e cacheia; nunca publica classificação oficial.

3. **Contratos compartilhados em `shared-contracts`.** Tipos de domínio (`Player`, `Championship`, `Edition`, `Match`, `EditionRules`, etc.) e schemas TypeBox de request/response pertencem a `@clandestino/shared-contracts`. API e web importam daqui — não duplique tipos entre apps.

4. **Validação em duas camadas.** `tournament-engine` valida regras de domínio (ex.: placar impossível). Fastify + TypeBox valida formato de entrada/saída HTTP. SQLite + constraints Drizzle impede estados inválidos persistidos.

5. **Regras configuráveis por edição.** Não codifique limiares fixos (“acima de 24 jogadores, melhor de 3”) em código de rota. Use `EditionRules` / `edition.rules` (jsonb).

6. **Determinismo auditável no sorteio.** Sorteios usam semente reproduzível (`random_seed` em `draw_snapshot`). Mesma entrada + mesma semente → mesmo resultado. A prévia aprovada (`approvedGroups`) é persistida e validada na publicação; não sorteie novamente entre etapas.

## Mapa de pacotes

### `@clandestino/shared-contracts`

- Exporta tipos e `*Schema` TypeBox por entidade (`player.ts`, `edition.ts`, `match.ts`, …).
- `DEFAULT_TOURNAMENT_RULES`, `DEFAULT_SCORING_TABLE`, `DEFAULT_GROUP_RANKING_CRITERIA` são defaults de produto — use-os, não invente valores paralelos.
- Ao adicionar campo em contrato: atualize schema TypeBox, tipos exportados em `index.ts` e consumidores (API mappers, testes).

### `@clandestino/tournament-engine`

Funções puras (referência em `packages/tournament-engine/src/index.ts`):

| Função                     | Responsabilidade                   |
| -------------------------- | ---------------------------------- |
| `chooseGroupConfiguration` | Número e tamanho dos grupos        |
| `allocateSeededPlayers`    | Distribui seeds (1 por grupo)      |
| `drawUnseededPlayers`      | Sorteia demais jogadores           |
| `generateGroupMatches`     | Round-robin do grupo               |
| `validateMatchResult`      | Rejeita placares impossíveis       |
| `calculateGroupStanding`   | Classificação do grupo             |
| `resolveTies`              | Desempate: sets → saldo → vitórias |
| `generatePlacementStage`   | Fase de colocação                  |
| `calculateFinalStanding`   | Colocação final da edição          |

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

React + Vite + PWA (`apps/web/`):

- TanStack Query para dados remotos; invalidação via SSE + polling (`use-edition-sync`) e após mutações
- Dexie/IndexedDB para cache da edição ativa e fila offline (`outbox`)
- GETs dinâmicos da API são `network-only` no service worker e usam `cache: 'no-store'`; mantenha o fallback offline em `edition-api.ts` + Dexie, não em cache HTTP
- Sessão do jogador: `player_id` + `edition_id` no IndexedDB (sem JWT no MVP)
- GET de edição com **404** = edição removida: não servir cache IndexedDB; chamar `purgeEditionLocalState` e limpar sessão do jogador
- Em dev (host): `VITE_API_URL=/api` + proxy Vite → `localhost:3000`
- Em dev (Caddy): `VITE_API_URL=/api` + proxy Caddy → `clandestino.test/api/*`
- Em produção: `web-build` (Docker) popula `CLANDESTINO_WEB_ROOT`; Caddy usa `file_server`

### Docker e Compose

| Arquivo                                | Função                                                           |
| -------------------------------------- | ---------------------------------------------------------------- |
| `start`                                | Wrapper: `./start dev`, `./start dev --seed`, `./start prod`     |
| `stop`                                 | Wrapper: `./stop [dev\|prod] [--volumes]` (auto-detecta a stack) |
| `docker-compose.yml`                   | Produção: `api` + `web-build` (Caddy externo)                    |
| `docker-compose.dev.yml`               | Dev completo: `api` + `web` + `caddy` (`clandestino.test`)       |
| `Dockerfile.dev`                       | Imagem compartilhada dev (deps + build de `packages/*`)          |
| `docker/caddy/Caddyfile.dev`           | Reverse proxy dev: `/api/*` → API, `/*` → Vite                   |
| `docker/caddy/Caddyfile.prod.external` | Fragmento Caddy externo (`file_server` + `/api` → API)           |
| `apps/api/Dockerfile`                  | Build multi-stage da API (produção)                              |
| `apps/web/Dockerfile`                  | Build multi-stage do PWA (target `export` → `web-build`)         |
| `apps/api/docker-entrypoint.sh`        | `db:migrate` + seed opcional + `node dist/server.js`             |
| `.dockerignore`                        | Contexto de build enxuto                                         |

**Agentes:** para testar no browser, prefira `./start dev`. Para stack prod local, `./start prod`. Para integração, defina `TEST_DATABASE_URL=file:./data/clandestino_test.db` — sem Docker. Não commite `.env` com credenciais.

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
pnpm test                              # raiz: shared-contracts + tournament-engine
pnpm test:all                          # raiz + web + API integração (requer TEST_DATABASE_URL)
pnpm --filter @clandestino/api test    # unitários + integração (se TEST_DATABASE_URL)
pnpm --filter @clandestino/tournament-engine test
pnpm --filter @clandestino/web test
pnpm test:e2e                          # Playwright E2E (sobe API + Vite; ver e2e/)
pnpm typecheck                         # todos os workspaces
```

**Unitários (sem banco):** `packages/*`, `apps/api/src/lib/*.test.ts`, `apps/web/src/**/*.test.ts`.

**Integração HTTP da API** (`apps/api/src/test/*.integration.test.ts`):

- `createApp` + Fastify `inject` + SQLite; simula organizador (`loginOrganizer`) e jogadores (`playerHeaders`) sem browser.
- Ignorados com `describe.skipIf(!hasTestDb)` quando `TEST_DATABASE_URL` está ausente.
- `TEST_DATABASE_URL=file:./data/clandestino_test.db` — arquivo separado do dev (`clandestino.db`) e do E2E (`clandestino_e2e.db`).
- `fileParallelism: false` no Vitest da API — não paralelizar arquivos de integração.
- Setup: `apps/api/src/test/integration-setup.ts` (`migrateTestDb`, `truncateAll`, `loginOrganizer`).
- Fluxos multi-passo: `apps/api/src/test/flow-helpers.ts` (`EditionFlowClient`). Ex.: `edition-lifecycle.integration.test.ts`.

Ao alterar rotas de auth, partidas, colocação, WO ou desistência, rode a suíte de integração antes de encerrar.

**E2E Playwright** (`e2e/`):

- `pnpm test:e2e:install` (uma vez), depois `pnpm test:e2e` ou `pnpm test:e2e:ui`.
- `e2e/playwright.config.ts` inicia API via `scripts/e2e-api.sh` e Vite em `:5173`.
- Setup HTTP em `e2e/helpers/api.ts`; specs em `e2e/specs/`. Padrão: preparar estado via API, assertar UI.
- Preferir integração HTTP para cobrir N jogadores; E2E para wiring de telas críticas.

- Lógica de torneio: prefira property-based (`fast-check`) para invariantes.
- Não adicione testes triviais que só repetem o compilador.

### Build e typecheck

```bash
pnpm install
pnpm build
pnpm typecheck
```

Ordem de dependência: `shared-contracts` → `tournament-engine` → `api` / `web`.

## Regras de negócio críticas

| Tópico           | Regra                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Desempate        | sets ganhos → saldo de sets → partidas vencidas                                                                                                |
| Seeds            | exatamente 1 por grupo; do ranking atual                                                                                                       |
| Confirmação      | adversário confirma; contestação → organizador; organizador pode oficializar `AGENDADA`/`AGUARDANDO_CONFIRMACAO` via `PUT /matches/:id/result` |
| Encerrar edição  | só quando todas as partidas estão `CONFIRMADA` ou `CANCELADA` (e colocação publicada, se houver bands)                                         |
| Auto-confirmação | job no Fastify (`setInterval`), configurável por edição                                                                                        |
| Match status     | `AGENDADA \| AGUARDANDO_CONFIRMACAO \| CONFIRMADA \| CONTESTADA \| CORRIGIDA \| CANCELADA`                                                     |
| Integridade DB   | um jogador por grupo/edição; sem partida duplicada na mesma fase; sem classificação final duplicada                                            |

## O que **não** fazer

- Colocar algoritmo de sorteio ou desempate diretamente em handlers Fastify.
- Calcular ou persistir `standing` oficial no cliente.
- Duplicar tipos/schemas fora de `shared-contracts`.
- Adicionar dependência de runtime (DB, fetch) em `tournament-engine`.
- Ignorar constraints do schema Drizzle ao inserir dados.
- Expandir escopo do MVP (push, multi-academia, export CSV) sem tarefa explícita.
- Criar commits ou PRs a menos que o usuário peça.

## Ambientes: desenvolvimento e produção

Consulte também [README.md](README.md) para o passo a passo humano. Resumo para agentes:

### Desenvolvimento local

Dois fluxos — escolha conforme a tarefa:

| Fluxo                          | Quando                                                                             | Subir                       |
| ------------------------------ | ---------------------------------------------------------------------------------- | --------------------------- |
| **Caddy (`clandestino.test`)** | Testar UI no browser com proxy igual à produção; não subir `api`/`web` manualmente | `./start dev`               |
| **Host (`localhost`)**         | Depuração em terminal, testes de integração, mudanças só na API                    | `pnpm dev` + `DATABASE_URL` |

#### Stack Caddy (browser / E2E manual)

Pré-requisito: `127.0.0.1 clandestino.test` no hosts (no WSL2, hosts do **Windows**).

```bash
# subir tudo (api + web + caddy); migrações automáticas no start da api
./start dev

# com seed de exemplo
./start dev --seed

# parar (data/clandestino.db preservado)
./stop dev
```

O script `./start` recusa subir dev se prod estiver rodando (e vice-versa). Seed em prod é bloqueado (`./start prod --seed` → erro). Para parar, `./stop` detecta a stack ativa; `./stop <env> --volumes` apaga `data/clandestino.db` (pede confirmação; não remove `clandestino_test.db`).

`./start dev` sobe a stack em segundo plano (`-d`). Equivalente manual: `docker compose -f docker-compose.dev.yml up -d --build`.

| Item              | Valor / regra no compose dev                                  |
| ----------------- | ------------------------------------------------------------- |
| PWA               | `http://clandestino.test`                                     |
| API (via proxy)   | `http://clandestino.test/api/health`                          |
| `NODE_ENV`        | `development` — magic link na resposta JSON                   |
| `PUBLIC_APP_URL`  | `http://clandestino.test`                                     |
| `VITE_API_URL`    | `/api` (mesma origem via Caddy)                               |
| Migrações         | automáticas no start do serviço `api`                         |
| Seed              | `./start dev --seed` (opcional)                               |
| Hot reload        | `apps/api` e `apps/web` montados por volume                   |
| Rebuild da imagem | após mudar `Dockerfile.dev`, deps ou `packages/*` (`--build`) |
| Banco SQLite      | bind mount `./data` → `/app/data/clandestino.db`              |

Não depende de `apps/api/.env` — variáveis vêm do `docker-compose.dev.yml`.

#### Host (API/PWA no terminal)

| Item                | Valor / comando                                              |
| ------------------- | ------------------------------------------------------------ |
| Banco               | arquivo `data/clandestino.db` (criado automaticamente)       |
| `DATABASE_URL`      | `file:./data/clandestino.db`                                 |
| `TEST_DATABASE_URL` | `file:./data/clandestino_test.db`                            |
| `NODE_ENV`          | não definir ou `development` / `test`                        |
| Magic link          | exposto na resposta JSON por padrão (testes sem e-mail)      |
| API                 | `pnpm --filter @clandestino/api dev` → `:3000`               |
| PWA                 | `pnpm --filter @clandestino/web dev` → `:5173`, proxy `/api` |
| Migrações           | `pnpm --filter @clandestino/api db:migrate`                  |
| Seed                | `pnpm --filter @clandestino/api db:seed` (opcional)          |
| Config              | copiar `apps/api/.env.example` → `apps/api/.env`             |

Fluxo mínimo após mudanças no schema (host):

```bash
export DATABASE_URL="file:./data/clandestino.db"
pnpm --filter @clandestino/api db:migrate
export TEST_DATABASE_URL="file:./data/clandestino_test.db"
pnpm --filter @clandestino/api test
pnpm typecheck
```

### Produção (Docker Compose)

| Item                       | Valor / regra                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `NODE_ENV`                 | **`production`** (já no serviço `api` do Compose)                                          |
| Magic link                 | **nunca** na resposta HTTP — enviado por e-mail via Resend                                 |
| `RESEND_API_KEY`           | **obrigatória** em produção                                                                |
| `EMAIL_FROM`               | remetente verificado no Resend (ex. `admin@sistema.pro.br`)                                |
| `EMAIL_FROM_NAME`          | nome exibido no e-mail (ex. `Clandestino - Tênis de Mesa`)                                 |
| `PUBLIC_APP_URL`           | URL pública HTTPS do PWA (magic links válidos)                                             |
| `ORGANIZER_ALLOWED_EMAILS` | e-mails reais do organizador                                                               |
| `SEED_ON_START`            | **`false`** — não rodar seed em produção                                                   |
| Subir stack                | `./start prod`                                                                             |
| Parar stack                | `./stop prod` (dados preservados)                                                          |
| Migrações                  | automáticas no entrypoint (`docker-entrypoint.sh`)                                         |
| PWA                        | `docker compose up -d --build` (`web-build` → `CLANDESTINO_WEB_ROOT`); Caddy `file_server` |
| `VITE_API_URL`             | prefixo da API no build do PWA (padrão `/api`, mesma origem via Caddy)                     |

**Segurança em produção (já implementada):**

- Rate limit nas rotas `/auth/organizer/magic-link` e `/verify` (`AUTH_RATE_LIMIT_*`).
- Limite de corpo na importação CSV (`CSV_IMPORT_MAX_BYTES`, retorna 413).
- Sessão de jogador via headers `X-Player-Id` / `X-Edition-Id` — sem token por jogador no MVP; autorização verifica participação na partida/edição.

**Agentes:** ao alterar `config.ts`, rotas de auth ou limites, valide com teste de integração e confirme comportamento com `NODE_ENV=production` (ver `auth.integration.test.ts`).

## Tarefas de implementação (docs/T*.md)

| Tarefa                               | Pacote              | Status    |
| ------------------------------------ | ------------------- | --------- |
| T1 — Monorepo e shared-contracts     | `shared-contracts`  | Concluído |
| T2 — tournament-engine               | `tournament-engine` | Concluído |
| T3+ — API (schema, rotas, jobs, SSE) | `api`               | Concluído |
| T8–T10 — Web PWA                     | `web`               | Concluído |

Ao pegar uma tarefa, leia o arquivo `docs/T*.md` correspondente e respeite critérios de aceitação e exclusões de escopo.

## Checklist antes de encerrar uma mudança

- [ ] Lógica de torneio permanece em `tournament-engine` (se aplicável)
- [ ] Schemas/tipos atualizados em `shared-contracts` (se contrato mudou)
- [ ] `pnpm typecheck` passa nos pacotes afetados
- [ ] `pnpm test` passa nos pacotes afetados
- [ ] Se alterou rotas da API: `TEST_DATABASE_URL` definida e `pnpm --filter @clandestino/api test` verde
- [ ] Se alterou fluxos de UI críticos: considerar `pnpm test:e2e` (após `pnpm test:e2e:install`)
- [ ] Migração Drizzle gerada se `schema.ts` mudou (`db:generate` + `db:migrate`)
- [ ] Sem secrets em código ou commits (`.env` está no `.gitignore`)
- [ ] Comportamento dev vs produção preservado (`NODE_ENV=production` não expõe magic links)
- [ ] Diff mínimo e alinhado ao pedido do usuário

## Referência rápida de documentação

| Preciso de…                     | Onde olhar                                                             |
| ------------------------------- | ---------------------------------------------------------------------- |
| Escopo do MVP                   | `docs/Epic Brief — Clandestino.md`                                     |
| Modelo de dados / SSE / offline | `docs/Tech Plan — Clandestino.md`                                      |
| Fluxos de tela                  | `docs/Core Flows — Clandestino.md`                                     |
| Critérios de uma tarefa         | `docs/T1 — …`, `docs/T2 — …`                                           |
| Schema do banco                 | `apps/api/src/db/schema.ts`                                            |
| Env vars e modos dev/prod       | `apps/api/src/config.ts`, `README.md`                                  |
| Docker / Compose                | `start`, `docker-compose.yml`, `docker-compose.dev.yml`, `README.md`   |
| Testes de integração            | `apps/api/src/test/integration-setup.ts`, `flow-helpers.ts`            |
| Testes E2E (Playwright)         | `e2e/playwright.config.ts`, `e2e/helpers/api.ts`, `scripts/e2e-api.sh` |
| Setup humano                    | `README.md`                                                            |
