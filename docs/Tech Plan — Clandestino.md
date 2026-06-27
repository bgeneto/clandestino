# Tech Plan — Clandestino

## 1. Abordagem Arquitetural

### Visão geral

O sistema é um **monorepo pnpm workspaces** com separação clara entre lógica de negócio, contrato compartilhado, API e interface. A lógica de torneio nunca vive nos controladores da API — ela reside em um pacote independente, determinístico e testável.

```
packages/
  tournament-engine/   ← lógica pura de torneio, sem I/O
  shared-contracts/    ← tipos TypeScript e schemas JSON compartilhados
apps/
  api/                 ← Fastify + Drizzle + PostgreSQL
  web/                 ← React + Vite + PWA
```

### Decisões e trade-offs

| Decisão           | Escolha                                     | Rationale                                                    |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------ |
| Monorepo          | pnpm workspaces                             | Leve, resolve dependências locais nativamente, sem overhead de Turborepo no MVP |
| Frontend          | React + Vite + TypeScript                   | SPA estática; sem SSR necessário para sistema interno        |
| PWA/Offline       | vite-plugin-pwa + Workbox + IndexedDB/Dexie | Fila de saída explícita para resultados; mais rastreável que cache otimista |
| API               | Fastify + TypeBox                           | Validação de schema em runtime; rejeita placares impossíveis antes do banco |
| ORM               | Drizzle                                     | Schema próximo do SQL; migrações versionadas; tipagem end-to-end |
| Banco             | PostgreSQL                                  | Constraints relacionais impedem estados inválidos (ex.: dois seeds no mesmo grupo) |
| Tempo real        | SSE (Server-Sent Events)                    | Unidirecional servidor→cliente; suficiente para atualizar classificação ao vivo |
| Sessão do jogador | Token local no IndexedDB                    | Sem conta formal; `player_id` + `edition_id` armazenados localmente; organizador corrige abusos |
| Auto-confirmação  | `setInterval` no processo Fastify           | Sem dependência externa; adequado para instância única no VPS |
| Deploy            | Docker Compose + Caddy + Cloudflare         | Alinhado com infraestrutura existente                        |

### Fluxo de uma requisição de registro de resultado (online)

```mermaid

```

### Fluxo offline → sincronização

```mermaid

```

### Constraints que o banco deve garantir

- Um jogador não pode aparecer em dois grupos da mesma edição
- Não pode existir mais de uma partida entre os mesmos dois jogadores na mesma fase
- Uma partida não pode ter resultado sem participantes registrados
- Não pode existir mais de uma classificação final por edição

------

## 2. Modelo de Dados

### Entidades principais

```mermaid

```

### Notas de modelagem

- **`edition.rules`** (jsonb): armazena `minimumGroupSize`, `preferredGroupSize`, `participantThresholdForBestOfThree`, `normalMatchBestOf`, `protectedSeedCount`, `groupRankingCriteria`
- **`season.scoring_table`** (jsonb): array de `{ position: number, points: number }`; posições não listadas recebem 0 ponto
- **`draw_snapshot`**: cópia imutável do ranking no momento do sorteio; inclui `algorithm`, `random_seed`, `drawn_by` para auditoria completa
- **`match.status`**: enum `AGENDADA | AGUARDANDO_CONFIRMACAO | CONFIRMADA | CONTESTADA | CORRIGIDA | CANCELADA`
- **`standing`**: recalculado pelo servidor a cada confirmação de resultado; nunca calculado no cliente
- **`audit_event`**: registra toda correção de resultado, cancelamento de sorteio e intervenção do organizador

------

## 3. Arquitetura de Componentes

### Mapa de componentes

```mermaid

```

### Responsabilidades por componente

#### `packages/tournament-engine`

- Funções puras sem I/O: `chooseGroupConfiguration`, `allocateSeededPlayers`, `drawUnseededPlayers`, `generateGroupMatches`, `validateMatchResult`, `calculateGroupStanding`, `resolveTies`, `generatePlacementStage`, `calculateFinalStanding`
- Testado com **Vitest + fast-check**: propriedades invariantes (ex.: "todo grupo tem exatamente 1 seed", "placar impossível é sempre rejeitado")
- Exporta apenas funções e tipos; zero dependências de runtime externas

#### `packages/shared-contracts`

- Tipos TypeScript compartilhados entre `api` e `web`: `TournamentRules`, `MatchStatus`, `DrawSnapshot`, `Standing`, `FinalPlacement`
- Schemas TypeBox para validação de request/response na API e para validação local no PWA

#### `apps/api` — Fastify

- **Rotas REST**: CRUD de jogadores, edições, grupos, partidas, resultados, classificações
- **SSE Handler**: endpoint `/editions/:id/events` — emite eventos `standing_updated`, `match_confirmed`, `phase_published` para todos os clientes conectados à edição
- **Auto-confirm Job**: `setInterval` a cada minuto; consulta partidas com `status = AGUARDANDO_CONFIRMACAO` e `created_at + auto_confirm_minutes < now()`; confirma automaticamente e emite evento SSE
- **Magic link**: geração e validação de token de acesso do organizador por e-mail; sem biblioteca OAuth externa no MVP
- **Importação CSV**: endpoint único para importar pontuação acumulada da temporada atual; valida e insere em `draw_snapshot` ou tabela de pontuação acumulada

#### `apps/web` — React PWA

- **TanStack Query**: gerencia cache de dados remotos; invalida queries ao receber eventos SSE
- **Dexie / IndexedDB**: persiste dados da edição ativa (grupos, partidas, classificação, sessão do jogador)
- **Fila de saída offline**: registros com `status = AGUARDANDO_SINCRONIZACAO`; o Service Worker processa a fila ao detectar conexão
- **Service Worker (Workbox)**: cache de assets estáticos (shell do app); intercepta requisições de mutação offline e enfileira na fila de saída
- **Sessão do jogador**: `player_id` + `edition_id` armazenados no IndexedDB; enviados como header em cada requisição autenticada; sem JWT no MVP

### Fluxo de atualização em tempo real (SSE)

```mermaid

```

### Limites de responsabilidade

| Responsabilidade                     | Onde vive                                                    |
| ------------------------------------ | ------------------------------------------------------------ |
| Validação de placar impossível       | `tournament-engine` (puro) + Fastify (runtime)               |
| Cálculo de classificação e desempate | `tournament-engine` (puro); resultado persistido pela API    |
| Sorteio de grupos                    | `tournament-engine` (puro); resultado persistido e auditado pela API |
| Sessão do jogador                    | IndexedDB no cliente; servidor confia na declaração          |
| Auto-confirmação por tempo           | Job no processo Fastify (`setInterval`)                      |
| Atualização ao vivo                  | SSE unidirecional servidor→cliente                           |
| Fila offline                         | IndexedDB + Service Worker no cliente                        |