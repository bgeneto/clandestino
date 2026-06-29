# Clandestino

Sistema web progressivo (PWA) para gerenciar campeonatos de tênis de mesa **Clandestino** da academia **FitPong**. Substitui o processo manual em papel — sorteio de grupos, registro de partidas e apuração de classificação — por um app mobile-first com ranking atual/acumulado por campeonato.

Consulte [docs/domain-taxonomy.md](docs/domain-taxonomy.md) para a taxonomia do domínio (Championship, Edition, EditionRules).

## O que o sistema faz

- Sorteia grupos com distribuição equilibrada de cabeças de chave (seeds)
- Gera partidas automaticamente (round-robin por grupo)
- Valida placares de sets conforme o formato da partida (melhor de 3 ou 5)
- Calcula classificação com critérios de desempate formalizados
- Mantém ranking atual da temporada com tabela de pontos configurável
- Permite acesso do jogador via QR code (sem senha) e do organizador via magic link

## Stack

| Camada            | Tecnologia                                                |
| ----------------- | --------------------------------------------------------- |
| Linguagem         | TypeScript (ESM, `NodeNext`)                              |
| Monorepo          | pnpm workspaces                                           |
| API               | Fastify + TypeBox                                         |
| Banco             | SQLite + Drizzle ORM                                      |
| Lógica de torneio | `@clandestino/tournament-engine` (funções puras)          |
| Contratos         | `@clandestino/shared-contracts` (tipos + schemas TypeBox) |
| Frontend          | React + Vite + PWA                                        |
| Testes            | Vitest + fast-check (property-based no motor de torneio)  |
| Deploy            | Docker Compose (`api`); PWA estático via proxy reverso    |

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
│   └── caddy/               # Caddyfile.dev (reverse proxy local)
├── docker-compose.yml       # API (produção)
├── docker-compose.dev.yml   # Dev: api + web + Caddy (clandestino.test)
├── Dockerfile.dev           # Imagem compartilhada do compose dev
├── start                    # Wrapper: ./start dev | dev --seed | prod
├── stop                     # Wrapper: ./stop [dev|prod] [--volumes]
├── docs/                    # Brief, tech plan, fluxos e tarefas
├── AGENTS.md                # Guia para agentes de IA
└── README.md
```

## Pré-requisitos

- Node.js ≥ 24 (`corepack enable` para pnpm 9)
- Docker + Docker Compose (recomendado para stack completa; obrigatório para produção local via Compose)

---

## Ambientes: desenvolvimento vs produção

O comportamento da API depende de `NODE_ENV` e das variáveis abaixo. Use esta tabela como referência rápida.

| Aspecto                     | Desenvolvimento (host)                            | Desenvolvimento (Caddy)                     | Produção                                            |
| --------------------------- | ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                  | ausente, `development` ou `test`                  | `development` (no `docker-compose.dev.yml`) | `production`                                        |
| Magic link na resposta JSON | **Sim** (padrão) — facilita testes sem e-mail     | **Sim**                                     | **Nunca** — mesmo com `EXPOSE_MAGIC_LINKS=true`     |
| Subir tudo                  | `pnpm dev` em terminais separados                 | `./start dev`                               | `./start prod` + build do PWA                       |
| URL do app                  | `http://localhost:5173`                           | `http://clandestino.test` (hosts + Caddy)   | URL pública HTTPS                                   |
| API                         | `pnpm dev` no host (hot reload)                   | container `api` (hot reload via volume)     | Imagem Docker (`docker compose up api`)             |
| PWA                         | `pnpm dev` no host (Vite, proxy `/api` → `:3000`) | container `web` (Vite atrás do Caddy)       | `pnpm build` + servir `apps/web/dist` (Caddy/nginx) |
| Banco                       | Arquivo SQLite (`data/clandestino.db`)            | bind mount `./data` → `/app/data`           | bind mount `./data` → `/app/data`                   |
| Seed                        | `db:seed` manual                                  | `./start dev --seed`                        | **Não** usar seed (`SEED_ON_START=false`)           |
| `PUBLIC_APP_URL`            | `http://localhost:5173`                           | `http://clandestino.test`                   | URL pública HTTPS do PWA                            |
| `ORGANIZER_ALLOWED_EMAILS`  | `organizador@gmail.com`                           | `organizador@gmail.com`                     | E-mails reais do organizador                        |
| Rate limit (magic link)     | Ativo (padrão 10 req / 15 min)                    | Ativo (padrão 10 req / 15 min)              | Ativo                                               |
| Testes de integração        | `TEST_DATABASE_URL` → arquivo `.db` separado      | idem                                        | Não rodam em deploy                                 |

Arquivos de exemplo: `apps/api/.env.example`, `apps/web/.env.example`.

---

## Desenvolvimento local

Dois fluxos válidos:

| Fluxo                          | Quando usar                                                                      | Comando principal           |
| ------------------------------ | -------------------------------------------------------------------------------- | --------------------------- |
| **Caddy (`clandestino.test`)** | Testar no browser com roteamento igual à produção, sem subir API/PWA manualmente | `./start dev`               |
| **Host (localhost)**           | Iterar com hot reload direto no terminal; depuração mais simples                 | `pnpm dev` em `api` e `web` |

### Stack completa via Caddy (`clandestino.test`) — recomendado para testar no browser

Um único comando sobe **API + PWA + Caddy**. O proxy encaminha `/api/*` para a API e `/*` para o Vite — mesmo padrão de produção. Hot reload em `apps/api` e `apps/web` (código montado por volume). O banco SQLite fica em `data/clandestino.db` (bind mount compartilhado com o fluxo host).

Arquivos: `start`, `docker-compose.dev.yml`, `Dockerfile.dev`, `docker/caddy/Caddyfile.dev`.

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
./start dev              # api + web + caddy (em segundo plano, migrações automáticas)
./start dev --seed       # idem, com dados de exemplo no start
```

Ambos sobem a stack em segundo plano (`-d`). O script verifica conflito com a stack prod, avisa se `clandestino.test` não estiver no hosts e delega migrações/seed ao start da API. Não é necessário `apps/api/.env` — as variáveis vêm do `docker-compose.dev.yml`. Acompanhe os logs com `docker compose -f docker-compose.dev.yml logs -f`.

Equivalente manual (troubleshooting):

```bash
docker compose -f docker-compose.dev.yml up -d --build
SEED_ON_START=true docker compose -f docker-compose.dev.yml up -d --build
```

#### 4. Acessar

| Recurso         | URL                                  |
| --------------- | ------------------------------------ |
| PWA             | `http://clandestino.test`            |
| API (via proxy) | `http://clandestino.test/api/health` |

- Magic link do organizador: `POST http://clandestino.test/api/auth/organizer/magic-link` com `{"email":"organizador@gmail.com"}` — o campo `magicLink` vem na resposta JSON (`NODE_ENV=development`).
- Roteamento do Caddy: `/api/*` → `api:3000` (remove o prefixo `/api`); `/*` → Vite (`web:5173`, HMR via WebSocket).

#### 5. Parar / logs / rebuild

```bash
./stop                                                   # detecta a stack ativa e para (dados preservados)
./stop dev                                               # para explicitamente a stack dev
./stop dev --volumes                                     # para e APAGA data/clandestino.db (pede confirmação)
docker compose -f docker-compose.dev.yml logs -f         # acompanhar todos os serviços
docker compose -f docker-compose.dev.yml logs -f api     # só a API
./start dev                                              # rebuild após mudar Dockerfile.dev / packages/*
```

Observações:

- Editou `packages/shared-contracts` ou `packages/tournament-engine`? Rebuild (`./start dev` refaz `--build`) — eles são consumidos via `./dist`.
- Dev e prod compartilham o mesmo bind mount `./data` (não rodam ao mesmo tempo).
- `./start prod --seed` é rejeitado (seed só em dev).
- `./stop` sem argumento detecta automaticamente qual stack está ativa; sem `--volumes`, os dados SQLite são preservados.

---

### Host: API e PWA no terminal (hot reload)

#### 1. Instalar dependências

```bash
pnpm install
```

#### 2. Configurar variáveis de ambiente

Copie os exemplos e ajuste se necessário:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Conteúdo mínimo da API em dev (`apps/api/.env`):

```bash
DATABASE_URL=file:./data/clandestino.db
PUBLIC_APP_URL=http://localhost:5173
# NODE_ENV não definido → magic link exposto na resposta JSON
```

O PWA em dev (`apps/web/.env`) usa proxy do Vite — o padrão já funciona:

```bash
VITE_API_URL=/api
```

#### 3. Migrar e popular o banco

```bash
pnpm --filter @clandestino/api db:migrate
pnpm --filter @clandestino/api db:seed   # opcional — jogadores e edição de exemplo
```

#### 4. Subir API e PWA

Em terminais separados:

```bash
pnpm --filter @clandestino/api dev    # http://localhost:3000
pnpm --filter @clandestino/web dev    # http://localhost:5173
```

- Health check da API: `GET http://localhost:3000/health` → `{"status":"ok"}`
- O Vite encaminha `/api/*` para a API local (ver `apps/web/vite.config.ts`).
- Para obter o magic link do organizador em dev: `POST /auth/organizer/magic-link` — o campo `magicLink` vem na resposta JSON.

### Alternativa: caminho absoluto do SQLite

```bash
export DATABASE_URL="file:./data/clandestino.db"
pnpm --filter @clandestino/api db:migrate
```

O diretório pai do arquivo é criado automaticamente no primeiro acesso.

---

## Produção (Docker Compose)

O `docker-compose.yml` sobe a **API** com `NODE_ENV=production`. O banco SQLite persiste em `data/clandestino.db` (bind mount `./data`). O PWA é buildado separadamente e servido por proxy reverso (Caddy/nginx) na frente da API e dos arquivos estáticos.

### 1. Ajustar variáveis no Compose

Edite `docker-compose.yml` (ou use um arquivo `.env` na raiz lido pelo Compose) **antes** de subir em produção:

| Variável                   | Valor em produção                                            |
| -------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`                 | `production` (já definido no serviço `api`)                  |
| `PUBLIC_APP_URL`           | URL pública do PWA, ex. `https://clandestino.sistema.pro.br` |
| `ORGANIZER_ALLOWED_EMAILS` | E-mails reais, separados por vírgula                         |
| `DATABASE_URL`             | `file:/app/data/clandestino.db` (bind mount `./data`)        |
| `SEED_ON_START`            | `false` (padrão) — **não** popular dados fictícios           |

Em produção, magic links **não** aparecem na resposta HTTP — é necessário enviar o link por e-mail (integração futura) ou consultar os logs do servidor.

### 2. Build e subir a stack

```bash
./start prod
curl http://localhost:3000/health   # {"status":"ok"}
```

Equivalente manual: `docker compose up -d --build`. O script força `SEED_ON_START=false` e recusa subir se a stack dev estiver ativa.

O entrypoint da API (`apps/api/docker-entrypoint.sh`) aplica migrações Drizzle automaticamente a cada start.

### 3. Build do PWA para produção

```bash
# Aponte para a URL pública da API (sem proxy /api)
VITE_API_URL=https://clandestino.sistema.pro.br/api pnpm --filter @clandestino/web build
```

Sirva `apps/web/dist` via Caddy/nginx. Exemplo de roteamento:

- `/api/*` → container `clandestino-api:3000` (strip prefix `/api`)
- `/*` → arquivos estáticos do PWA

### 4. Parar / atualizar

```bash
./stop prod                  # para a stack prod (dados preservados)
./start prod                 # reaplica migrações no start da API
```

Equivalente manual: `docker compose down` / `docker compose up -d --build`.

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
# Só unitários (sem arquivo de teste)
pnpm --filter @clandestino/api test

# Unitários + integração HTTP (requer TEST_DATABASE_URL)
export TEST_DATABASE_URL="file:./data/clandestino_test.db"
pnpm --filter @clandestino/api test
```

Os testes em `apps/api/src/test/*.integration.test.ts` usam Fastify `inject` contra SQLite real. São **ignorados automaticamente** quando `TEST_DATABASE_URL` não está definida.

Não é necessário Docker para rodar a integração — basta definir `TEST_DATABASE_URL`.

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
export TEST_DATABASE_URL="file:./data/clandestino_test.db"
pnpm --filter @clandestino/api test
```

---

## Variáveis de ambiente (referência)

### API (`apps/api/.env`)

| Variável                           | Padrão                  | Descrição                                                       |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                     | —                       | **Obrigatória.** Caminho SQLite (`file:./data/clandestino.db`)  |
| `API_HOST`                         | `0.0.0.0`               | Host do Fastify                                                 |
| `API_PORT`                         | `3000`                  | Porta da API                                                    |
| `NODE_ENV`                         | —                       | `production` ativa modo seguro (sem magic link na resposta)     |
| `PUBLIC_APP_URL`                   | `http://localhost:5173` | Base do PWA nos links de organizador                            |
| `ORGANIZER_ALLOWED_EMAILS`         | `organizador@gmail.com` | E-mails autorizados (vírgula)                                   |
| `ORGANIZER_MAGIC_LINK_TTL_MINUTES` | `15`                    | Validade do magic link                                          |
| `ORGANIZER_SESSION_TTL_HOURS`      | `168`                   | Validade da sessão do organizador                               |
| `EXPOSE_MAGIC_LINKS`               | exposto em dev          | Força exposição em dev; **ignorado** em produção                |
| `AUTH_RATE_LIMIT_MAX`              | `10`                    | Máx. requisições nas rotas de magic link                        |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES`   | `15`                    | Janela do rate limit                                            |
| `CSV_IMPORT_MAX_BYTES`             | `1048576`               | Limite do corpo na importação CSV                               |
| `TEST_DATABASE_URL`                | —                       | Arquivo SQLite para testes de integração (não usar em produção) |
| `SEED_ON_START`                    | `false`                 | Só no Docker: rodar `db:seed` no entrypoint                     |

Fonte da verdade: `apps/api/src/config.ts`.

### Web (`apps/web/.env`)

| Variável       | Padrão | Descrição                                                                                                       |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | `/api` | Prefixo da API. Em dev, o proxy Vite encaminha para `:3000`. Em produção, URL absoluta ou path do reverse proxy |

---

## Scripts principais

| Comando                                      | Descrição                                        |
| -------------------------------------------- | ------------------------------------------------ |
| `./start dev`                                | Dev completo: api + web + Caddy                  |
| `./start dev --seed`                         | Idem, com seed no start                          |
| `./start prod`                               | API (produção local, detached)                   |
| `./start --help`                             | Ajuda do wrapper de start                        |
| `./stop`                                     | Detecta a stack ativa e para (dados preservados) |
| `./stop dev` / `./stop prod`                 | Para a stack indicada                            |
| `./stop <env> --volumes`                     | Para e apaga `data/clandestino.db` (confirmação) |
| `pnpm build`                                 | Compila todos os workspaces                      |
| `pnpm test`                                  | Testes da raiz (contracts + engine)              |
| `pnpm typecheck`                             | TypeScript em todos os pacotes                   |
| `pnpm --filter @clandestino/api dev`         | API com hot reload                               |
| `pnpm --filter @clandestino/api start`       | API compilada (`node dist/server.js`)            |
| `pnpm --filter @clandestino/api db:generate` | Gera migrações Drizzle                           |
| `pnpm --filter @clandestino/api db:migrate`  | Aplica migrações                                 |
| `pnpm --filter @clandestino/api db:seed`     | Dados de desenvolvimento                         |
| `pnpm --filter @clandestino/api test`        | Testes unitários + integração                    |
| `pnpm --filter @clandestino/web dev`         | PWA com Vite                                     |
| `pnpm --filter @clandestino/web build`       | Build de produção do PWA                         |

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
- **Seeds:** 1 por grupo, definidos pelo ranking atual/acumulado da temporada
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
