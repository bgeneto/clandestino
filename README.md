# Clandestino

Sistema web progressivo (PWA) para gerenciar o campeonato de tênis de mesa **Clandestino** da academia **FitPong**. Substitui o processo manual em papel — sorteio de grupos, registro de partidas e apuração de classificação — por um app mobile-first com ranking acumulado da temporada.

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
│   ├── caddy/               # Caddyfile.dev (reverse proxy local)
│   └── postgres/            # init.sql (cria clandestino_test)
├── docker-compose.yml       # PostgreSQL + API (produção)
├── docker-compose.dev.yml   # Dev: db + api + web + Caddy (clandestino.test)
├── Dockerfile.dev           # Imagem compartilhada do compose dev
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

| Aspecto                     | Desenvolvimento (host)                            | Desenvolvimento (Caddy)                        | Produção                                            |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                  | ausente, `development` ou `test`                  | `development` (no `docker-compose.dev.yml`)    | `production`                                        |
| Magic link na resposta JSON | **Sim** (padrão) — facilita testes sem e-mail     | **Sim**                                        | **Nunca** — mesmo com `EXPOSE_MAGIC_LINKS=true`     |
| Subir tudo                  | `pnpm dev` em terminais separados                 | `docker compose -f docker-compose.dev.yml up`  | `docker compose up -d --build` + build do PWA       |
| URL do app                  | `http://localhost:5173`                           | `http://clandestino.test` (hosts + Caddy)      | URL pública HTTPS                                   |
| API                         | `pnpm dev` no host (hot reload)                   | container `api` (hot reload via volume)        | Imagem Docker (`docker compose up api`)             |
| PWA                         | `pnpm dev` no host (Vite, proxy `/api` → `:3000`) | container `web` (Vite atrás do Caddy)          | `pnpm build` + servir `apps/web/dist` (Caddy/nginx) |
| Banco                       | Container (`:5433`) ou Postgres local (`:5432`)   | container `db` (`:5433`)                       | Container na rede interna do Compose                |
| Seed                        | `db:seed` manual                                  | `SEED_ON_START=true` no compose dev (opcional) | **Não** usar seed (`SEED_ON_START=false`)           |
| `PUBLIC_APP_URL`            | `http://localhost:5173`                           | `http://clandestino.test`                      | URL pública HTTPS do PWA                            |
| `ORGANIZER_ALLOWED_EMAILS`  | `organizador@fitpong.local`                       | `organizador@fitpong.local`                    | E-mails reais do organizador                        |
| Rate limit (magic link)     | Ativo (padrão 10 req / 15 min)                    | Ativo (padrão 10 req / 15 min)                 | Ativo                                               |
| Testes de integração        | `TEST_DATABASE_URL` → `clandestino_test`          | idem (banco exposto em `:5433`)                | Não rodam em deploy                                 |

Arquivos de exemplo: `apps/api/.env.example`, `apps/web/.env.example`.

---

## Desenvolvimento local

Dois fluxos válidos:

| Fluxo                          | Quando usar                                                                      | Comando principal                                     |
| ------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Caddy (`clandestino.test`)** | Testar no browser com roteamento igual à produção, sem subir API/PWA manualmente | `docker compose -f docker-compose.dev.yml up --build` |
| **Host (localhost)**           | Iterar com hot reload direto no terminal; depuração mais simples                 | `pnpm dev` em `api` e `web`                           |

### Stack completa via Caddy (`clandestino.test`) — recomendado para testar no browser

Um único comando sobe **PostgreSQL + API + PWA + Caddy**. O proxy encaminha `/api/*` para a API e `/*` para o Vite — mesmo padrão de produção. Hot reload em `apps/api` e `apps/web` (código montado por volume).

Arquivos: `docker-compose.dev.yml`, `Dockerfile.dev`, `docker/caddy/Caddyfile.dev`.

#### 1. Pré-requisitos

```bash
pnpm install   # só na primeira vez; a imagem dev também instala deps no build
```

#### 2. Hosts

Adicione ao arquivo hosts da sua máquina:

```text
127.0.0.1   clandestino.test
```

- Linux/macOS: `/etc/hosts`
- **WSL2:** edite o hosts do **Windows** (`C:\Windows\System32\drivers\etc\hosts`) — o navegador roda no Windows e o WSL2 encaminha `localhost` automaticamente.

#### 3. Subir a stack

```bash
# primeiro build (ou após mudar Dockerfile.dev / dependências)
docker compose -f docker-compose.dev.yml up --build

# em segundo plano
docker compose -f docker-compose.dev.yml up --build -d

# com dados de exemplo (seed) no start
SEED_ON_START=true docker compose -f docker-compose.dev.yml up --build
```

Migrações rodam automaticamente no start do serviço `api`. Não é necessário `apps/api/.env` para este fluxo — as variáveis vêm do `docker-compose.dev.yml`.

#### 4. Acessar

| Recurso         | URL                                  |
| --------------- | ------------------------------------ |
| PWA             | `http://clandestino.test`            |
| API (via proxy) | `http://clandestino.test/api/health` |

- Magic link do organizador: `POST http://clandestino.test/api/auth/organizer/magic-link` com `{"email":"organizador@fitpong.local"}` — o campo `magicLink` vem na resposta JSON (`NODE_ENV=development`).
- Roteamento do Caddy: `/api/*` → `api:3000` (remove o prefixo `/api`); `/*` → Vite (`web:5173`, HMR via WebSocket).

#### 5. Parar / logs / rebuild

```bash
docker compose -f docker-compose.dev.yml down          # mantém dados em ./clandestino-db
docker compose -f docker-compose.dev.yml logs -f     # acompanhar todos os serviços
docker compose -f docker-compose.dev.yml logs -f api # só a API
docker compose -f docker-compose.dev.yml up --build  # após mudar packages/* (pré-compilados na imagem)
```

Observações:

- Editou `packages/shared-contracts` ou `packages/tournament-engine`? Rebuild da imagem (`--build`) — eles são consumidos via `./dist`.
- O banco usa o mesmo volume (`./clandestino-db`) e porta host (`5433`) do `docker-compose.yml` padrão.
- Não rode `docker-compose.yml` e `docker-compose.dev.yml` ao mesmo tempo — ambos usam a porta `5433` e o volume do Postgres.

---

### Host: banco no Docker, API e PWA no terminal (hot reload)

#### 1. Instalar dependências

```bash
pnpm install
```

#### 2. Subir o PostgreSQL

```bash
docker compose up -d db
```

O banco fica em `localhost:5433` (mapeamento `5433:5432`). Na primeira inicialização, `docker/postgres/init.sql` cria também o banco `clandestino_test` para testes de integração.

#### 3. Configurar variáveis de ambiente

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

#### 4. Migrar e popular o banco

```bash
pnpm --filter @clandestino/api db:migrate
pnpm --filter @clandestino/api db:seed   # opcional — jogadores e edição de exemplo
```

#### 5. Subir API e PWA

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

| Comando                                                                  | Descrição                             |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `pnpm build`                                                             | Compila todos os workspaces           |
| `pnpm test`                                                              | Testes da raiz (contracts + engine)   |
| `pnpm typecheck`                                                         | TypeScript em todos os pacotes        |
| `pnpm --filter @clandestino/api dev`                                     | API com hot reload                    |
| `pnpm --filter @clandestino/api start`                                   | API compilada (`node dist/server.js`) |
| `pnpm --filter @clandestino/api db:generate`                             | Gera migrações Drizzle                |
| `pnpm --filter @clandestino/api db:migrate`                              | Aplica migrações                      |
| `pnpm --filter @clandestino/api db:seed`                                 | Dados de desenvolvimento              |
| `pnpm --filter @clandestino/api test`                                    | Testes unitários + integração         |
| `pnpm --filter @clandestino/web dev`                                     | PWA com Vite                          |
| `pnpm --filter @clandestino/web build`                                   | Build de produção do PWA              |
| `docker compose up -d db`                                                | Só PostgreSQL (fluxo host)            |
| `docker compose -f docker-compose.dev.yml up --build`                    | Dev completo: db + api + web + Caddy  |
| `SEED_ON_START=true docker compose -f docker-compose.dev.yml up --build` | Idem, com seed no start               |
| `docker compose -f docker-compose.dev.yml down`                          | Para a stack dev (mantém volume DB)   |
| `docker compose up -d --build`                                           | PostgreSQL + API (produção)           |

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
