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

| Camada            | Tecnologia                                                |
| ----------------- | --------------------------------------------------------- |
| Linguagem         | TypeScript (ESM, `NodeNext`)                              |
| Monorepo          | pnpm workspaces                                           |
| API               | Fastify + TypeBox                                         |
| Banco             | PostgreSQL + Drizzle ORM                                  |
| Lógica de torneio | `@clandestino/tournament-engine` (funções puras)          |
| Contratos         | `@clandestino/shared-contracts` (tipos + schemas TypeBox) |
| Frontend          | React + Vite + PWA _(em desenvolvimento)_                 |
| Testes            | Vitest + fast-check (property-based no motor de torneio)  |
| Deploy planejado  | Docker Compose + Caddy + Cloudflare                       |

## Estrutura do repositório

```
clandestino/
├── apps/
│   ├── api/                 # Fastify, Drizzle, rotas REST
│   └── web/                 # React PWA (stub — T8–T10)
├── packages/
│   ├── shared-contracts/    # Tipos e schemas compartilhados
│   └── tournament-engine/   # Sorteio, validação e classificação (sem I/O)
├── docs/                    # Brief, tech plan, fluxos e tarefas (T1, T2, …)
├── AGENTS.md                # Guia para agentes de IA e contribuidores
└── README.md
```

## Pré-requisitos

- Node.js ≥ 20
- pnpm 9 (`corepack enable` ou `npm i -g pnpm`)
- PostgreSQL 15+ (local ou container)

## Primeiros passos

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar o banco

Crie um banco PostgreSQL e defina `DATABASE_URL` para a API. Exemplo:

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/clandestino"
```

Variáveis opcionais (ver `apps/api/src/config.ts`):

| Variável                           | Padrão                      | Descrição                               |
| ---------------------------------- | --------------------------- | --------------------------------------- |
| `API_HOST`                         | `0.0.0.0`                   | Host do servidor Fastify                |
| `API_PORT`                         | `3000`                      | Porta da API                            |
| `PUBLIC_APP_URL`                   | `http://localhost:5173`     | URL base do PWA (magic links)           |
| `ORGANIZER_ALLOWED_EMAILS`         | `organizador@fitpong.local` | E-mails autorizados (vírgula)           |
| `ORGANIZER_MAGIC_LINK_TTL_MINUTES` | `15`                        | Validade do magic link                  |
| `ORGANIZER_SESSION_TTL_HOURS`      | `168`                       | Validade da sessão do organizador       |
| `EXPOSE_MAGIC_LINKS`               | `true` fora de produção     | Retorna o link na resposta da API (dev) |

### 3. Migrar e popular o banco

```bash
pnpm --filter @clandestino/api db:migrate
pnpm --filter @clandestino/api db:seed   # opcional — dados de desenvolvimento
```

### 4. Subir a API

```bash
pnpm --filter @clandestino/api dev
```

Health check: `GET http://localhost:3000/health`

### 5. Build e testes (raiz)

```bash
pnpm build
pnpm test
pnpm typecheck
```

## Scripts principais

| Comando                                      | Descrição                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm build`                                 | Compila todos os workspaces                                                       |
| `pnpm test`                                  | Roda testes (shared-contracts + tournament-engine na raiz; API tem suite própria) |
| `pnpm typecheck`                             | Verificação TypeScript em todos os pacotes                                        |
| `pnpm --filter @clandestino/api dev`         | API em modo watch                                                                 |
| `pnpm --filter @clandestino/api db:generate` | Gera migrações Drizzle a partir do schema                                         |
| `pnpm --filter @clandestino/api db:migrate`  | Aplica migrações                                                                  |
| `pnpm --filter @clandestino/api db:seed`     | Seed de desenvolvimento                                                           |

## Estado atual do desenvolvimento

| Área                | Status                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| `shared-contracts`  | Tipos e schemas TypeBox completos                                          |
| `tournament-engine` | Funções puras com testes property-based                                    |
| `api`               | Auth (magic link), jogadores, temporadas, edições, sorteio, importação CSV |
| `web`               | Stub — UI React/PWA planeada em T8–T10                                     |
| PWA / offline / SSE | Planejados — ver [Tech Plan](docs/Tech%20Plan%20—%20Clandestino.md)        |

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
| [docs/Epic Brief — Clandestino.md](docs/Epic%20Brief%20—%20Clandestino.md) | Escopo do MVP e critérios de sucesso           |
| [docs/Tech Plan — Clandestino.md](docs/Tech%20Plan%20—%20Clandestino.md)   | Arquitetura, modelo de dados, componentes      |
| [docs/Core Flows — Clandestino.md](docs/Core%20Flows%20—%20Clandestino.md) | Fluxos de jogador, organizador e público       |
| [AGENTS.md](AGENTS.md)                                                     | Convenções de código e guia para agentes de IA |

## Licença

Projeto privado — uso interno FitPong / Clandestino.
