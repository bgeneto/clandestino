# Clandestino

Sistema web progressivo (PWA) para gerenciar o campeonato semanal de tênis de mesa **Clandestino** da academia **FitPong**. Substitui o processo manual em papel — sorteio de grupos, registro de partidas e apuração de classificação — por um app mobile-first com ranking acumulado da temporada.

## O que o sistema faz

- Sorteia grupos com distribuição equilibrada de cabeças de chave (seeds)
- Gera partidas automaticamente (round-robin por grupo)
- Valida placares de sets conforme o formato da partida (melhor de 3 ou 5)
- Calcula classificação com critérios de desempate formalizados
- Mantém ranking acumulado da temporada com tabela de pontos configurável
- Permite acesso do jogador via QR code (sem senha) e do organizador via magic link

## Stack

| Camada            | Tecnologia                                                    |
| ----------------- | ------------------------------------------------------------- |
| Linguagem         | TypeScript (ESM, `NodeNext`)                                  |
| Monorepo          | pnpm workspaces                                               |
| API               | Fastify + TypeBox                                             |
| Banco             | PostgreSQL + Drizzle ORM                                      |
| Lógica de torneio | `@clandestino/tournament-engine` (funções puras)              |
| Contratos         | `@clandestino/shared-contracts` (tipos + schemas TypeBox)     |
| Frontend          | React + Vite + PWA                                            |
| Testes            | Vitest + fast-check (property-based no motor de torneio)      |
| Deploy            | Docker Compose (`db` + `api`); PWA estático via proxy reverso |

## Estrutura do repositório

```
clandestino/
├── apps/
│   ├── api/                 # Fastify, Drizzle, rotas REST
│   └── web/                 # React PWA (Vite + Workbox)
├── packages/
│   ├── shared-contracts/    # Tipos e schemas compartilhados
│   └── tournament-engine/   # Sorteio, validação e classificação (sem I/O)
├── docker/
│   └── postgres/            # init.sql (cria clandestino_test)
├── docker-compose.yml       # PostgreSQL + API (produção local / staging)
├── docs/                    # Brief, tech plan, fluxos e tarefas
├── AGENTS.md                # Guia para agentes de IA
└── README.md
```

## Pré-requisitos

- Node.js ≥ 24 (`corepack enable` para pnpm 9)
- Docker + Docker Compose (recomendado para o banco; obrigatório para stack de produção)
- PostgreSQL 16+ (somente se preferir banco nativo em vez do container)

---

## Ambientes: desenvolvimento vs produção

O comportamento da API depende de `NODE_ENV` e das variáveis abaixo. Use esta tabela como referência rápida.

| Aspecto                     | Desenvolvimento                                     | Produção                                            |
| --------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                  | ausente, `development` ou `test`                    | `production`                                        |
| Magic link na resposta JSON | **Sim** (padrão) — facilita testes sem e-mail       | **Nunca** — mesmo com `EXPOSE_MAGIC_LINKS=true`     |
| API                         | `pnpm dev` no host (hot reload)                     | Imagem Docker (`docker compose up api`)             |
| PWA                         | `pnpm dev` no host (Vite, proxy `/api` → `:3000`)   | `pnpm build` + servir `apps/web/dist` (Caddy/nginx) |
| Banco                       | Container (`:5433`) ou Postgres local (`:5432`)     | Container na rede interna do Compose                |
| Seed                        | `db:seed` manual ou `SEED_ON_START=true` no Compose | **Não** usar seed (`SEED_ON_START=false`)           |
| `PUBLIC_APP_URL`            | `http://localhost:5173`                             | URL pública HTTPS do PWA                            |
| `ORGANIZER_ALLOWED_EMAILS`  | `organizador@fitpong.local`                         | E-mails reais do organizador                        |
| Rate limit (magic link)     | Ativo (padrão 10 req / 15 min)                      | Ativo                                               |
| Testes de integração        | `TEST_DATABASE_URL` → `clandestino_test`            | Não rodam em deploy                                 |

Arquivos de exemplo: `apps/api/.env.example`, `apps/web/.env.example`.

---

## Desenvolvimento local

Fluxo recomendado: **banco no Docker**, API e PWA no host (hot reload).

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Subir o PostgreSQL

```bash
docker compose up -d db
```

O banco fica em `localhost:5433` (mapeamento `5433:5432`). Na primeira inicialização, `docker/postgres/init.sql` cria também o banco `clandestino_test` para testes de integração.

### 3. Configurar variáveis de ambiente

Copie os exemplos e ajuste se necessário:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Conteúdo mínimo da API em dev (`apps/api/.env`):

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/clandestino
PUBLIC_APP_URL=http://localhost:5173
# NODE_ENV não definido → magic link exposto na resposta JSON
```

O PWA em dev (`apps/web/.env`) usa proxy do Vite — o padrão já funciona:

```bash
VITE_API_URL=/api
```

### 4. Migrar e popular o banco

```bash
pnpm --filter @clandestino/api db:migrate
pnpm --filter @clandestino/api db:seed   # opcional — jogadores e edição de exemplo
```

### 5. Subir API e PWA

Em terminais separados:

```bash
pnpm --filter @clandestino/api dev    # http://localhost:3000
pnpm --filter @clandestino/web dev    # http://localhost:5173
```

- Health check da API: `GET http://localhost:3000/health` → `{"status":"ok"}`
- O Vite encaminha `/api/*` para a API local (ver `apps/web/vite.config.ts`).
- Para obter o magic link do organizador em dev: `POST /auth/organizer/magic-link` — o campo `magicLink` vem na resposta JSON.

### Alternativa: Postgres nativo (sem Docker)

```bash
createdb clandestino
createdb clandestino_test
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/clandestino"
pnpm --filter @clandestino/api db:migrate
```

Use porta `5432` na `DATABASE_URL` em vez de `5433`.

---

## Produção (Docker Compose)

O `docker-compose.yml` sobe **PostgreSQL + API** com `NODE_ENV=production`. O PWA é buildado separadamente e servido por proxy reverso (Caddy/nginx) na frente da API e dos arquivos estáticos.

### 1. Ajustar variáveis no Compose

Edite `docker-compose.yml` (ou use um arquivo `.env` na raiz lido pelo Compose) **antes** de subir em produção:

| Variável                   | Valor em produção                                                |
| -------------------------- | ---------------------------------------------------------------- |
| `NODE_ENV`                 | `production` (já definido no serviço `api`)                      |
| `PUBLIC_APP_URL`           | URL pública do PWA, ex. `https://clandestino.fitpong.com`        |
| `ORGANIZER_ALLOWED_EMAILS` | E-mails reais, separados por vírgula                             |
| `DATABASE_URL`             | `postgres://postgres:<senha>@db:5432/clandestino` (rede interna) |
| `SEED_ON_START`            | `false` (padrão) — **não** popular dados fictícios               |
| `POSTGRES_PASSWORD`        | Senha forte (serviço `db`)                                       |

Em produção, magic links **não** aparecem na resposta HTTP — é necessário enviar o link por e-mail (integração futura) ou consultar os logs do servidor.

### 2. Build e subir a stack

```bash
docker compose up -d --build
curl http://localhost:3000/health   # {"status":"ok"}
```

O entrypoint da API (`apps/api/docker-entrypoint.sh`) aplica migrações Drizzle automaticamente a cada start.

### 3. Build do PWA para produção

```bash
# Aponte para a URL pública da API (sem proxy /api)
VITE_API_URL=https://clandestino.fitpong.com/api pnpm --filter @clandestino/web build
```

Sirva `apps/web/dist` via Caddy/nginx. Exemplo de roteamento:

- `/api/*` → container `clandestino-api:3000` (strip prefix `/api`)
- `/*` → arquivos estáticos do PWA

### 4. Parar / atualizar

```bash
docker compose down          # mantém dados em ./clandestino-db
docker compose up -d --build # reaplica migrações no start da API
```

---

## Testes

### Pacotes sem banco (sempre rodam)

```bash
pnpm test          # shared-contracts + tournament-engine (raiz)
pnpm typecheck     # todos os workspaces
pnpm build         # compila todos os pacotes
```

### API — unitários + integração

```bash
# Só unitários (sem PostgreSQL)
pnpm --filter @clandestino/api test

# Unitários + integração HTTP (requer banco de testes)
export TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5433/clandestino_test"
pnpm --filter @clandestino/api test
```

Os testes em `apps/api/src/test/*.integration.test.ts` usam Fastify `inject` contra PostgreSQL real. São **ignorados automaticamente** quando `TEST_DATABASE_URL` não está definida.

Pré-requisito: container `db` rodando (`docker compose up -d db`).

### Web

```bash
pnpm --filter @clandestino/web test
```

### Antes de push (hook pre-push)

```bash
pnpm format:check && pnpm typecheck && pnpm test
```

Para validar a API com integração antes do push:

```bash
export TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5433/clandestino_test"
pnpm --filter @clandestino/api test
```

---

## Variáveis de ambiente (referência)

### API (`apps/api/.env`)

| Variável                           | Padrão                      | Descrição                                                   |
| ---------------------------------- | --------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                     | —                           | **Obrigatória.** String de conexão PostgreSQL               |
| `API_HOST`                         | `0.0.0.0`                   | Host do Fastify                                             |
| `API_PORT`                         | `3000`                      | Porta da API                                                |
| `NODE_ENV`                         | —                           | `production` ativa modo seguro (sem magic link na resposta) |
| `PUBLIC_APP_URL`                   | `http://localhost:5173`     | Base do PWA nos links de organizador                        |
| `ORGANIZER_ALLOWED_EMAILS`         | `organizador@fitpong.local` | E-mails autorizados (vírgula)                               |
| `ORGANIZER_MAGIC_LINK_TTL_MINUTES` | `15`                        | Validade do magic link                                      |
| `ORGANIZER_SESSION_TTL_HOURS`      | `168`                       | Validade da sessão do organizador                           |
| `EXPOSE_MAGIC_LINKS`               | exposto em dev              | Força exposição em dev; **ignorado** em produção            |
| `AUTH_RATE_LIMIT_MAX`              | `10`                        | Máx. requisições nas rotas de magic link                    |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES`   | `15`                        | Janela do rate limit                                        |
| `CSV_IMPORT_MAX_BYTES`             | `1048576`                   | Limite do corpo na importação CSV                           |
| `TEST_DATABASE_URL`                | —                           | Banco para testes de integração (não usar em produção)      |
| `SEED_ON_START`                    | `false`                     | Só no Docker: rodar `db:seed` no entrypoint                 |

Fonte da verdade: `apps/api/src/config.ts`.

### Web (`apps/web/.env`)

| Variável       | Padrão | Descrição                                                                                                       |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | `/api` | Prefixo da API. Em dev, o proxy Vite encaminha para `:3000`. Em produção, URL absoluta ou path do reverse proxy |

---

## Scripts principais

| Comando                                      | Descrição                             |
| -------------------------------------------- | ------------------------------------- |
| `pnpm build`                                 | Compila todos os workspaces           |
| `pnpm test`                                  | Testes da raiz (contracts + engine)   |
| `pnpm typecheck`                             | TypeScript em todos os pacotes        |
| `pnpm --filter @clandestino/api dev`         | API com hot reload                    |
| `pnpm --filter @clandestino/api start`       | API compilada (`node dist/server.js`) |
| `pnpm --filter @clandestino/api db:generate` | Gera migrações Drizzle                |
| `pnpm --filter @clandestino/api db:migrate`  | Aplica migrações                      |
| `pnpm --filter @clandestino/api db:seed`     | Dados de desenvolvimento              |
| `pnpm --filter @clandestino/api test`        | Testes unitários + integração         |
| `pnpm --filter @clandestino/web dev`         | PWA com Vite                          |
| `pnpm --filter @clandestino/web build`       | Build de produção do PWA              |
| `docker compose up -d db`                    | Só PostgreSQL                         |
| `docker compose up -d --build`               | PostgreSQL + API (produção)           |

---

## Estado atual do desenvolvimento

| Área                | Status                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `shared-contracts`  | Tipos e schemas TypeBox completos                                    |
| `tournament-engine` | Funções puras com testes property-based                              |
| `api`               | Rotas REST, auth, sorteio, partidas, SSE, jobs, testes de integração |
| `web`               | PWA React com offline, SSE e fluxos de jogador/organizador           |
| Deploy PWA + TLS    | Planejado — Caddy/Cloudflare na frente do Compose                    |

## Regras de negócio (resumo)

- **Desempate:** sets ganhos → saldo de sets → partidas vencidas
- **Seeds:** 1 por grupo, definidos pelo ranking acumulado da temporada
- **Ranking:** pontos por colocação (tabela padrão editável por temporada)
- **Resultado:** placar em sets; adversário confirma; organizador resolve contestações
- **Classificação oficial:** sempre recalculada no servidor — nunca no cliente

Detalhes em [Epic Brief](docs/Epic%20Brief%20—%20Clandestino.md) e [Core Flows](docs/Core%20Flows%20—%20Clandestino.md).

## Documentação

| Documento                                                                  | Conteúdo                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| [docs/ideation.md](docs/ideation.md)                                       | Origem do projeto e decisões de stack          |
| [docs/Epic Brief — Clandestino.md](docs/Epic%20Brief%20—%20Clandestino.md) | Escopo do MVP                                  |
| [docs/Tech Plan — Clandestino.md](docs/Tech%20Plan%20—%20Clandestino.md)   | Arquitetura e modelo de dados                  |
| [docs/Core Flows — Clandestino.md](docs/Core%20Flows%20—%20Clandestino.md) | Fluxos de tela                                 |
| [AGENTS.md](AGENTS.md)                                                     | Guia para agentes de IA e convenções de código |

## Licença

Projeto privado — uso interno FitPong / Clandestino.
