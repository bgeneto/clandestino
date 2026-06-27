---
id: "61be083b-ed4a-496b-af0d-1e236e80156c"
title: "Tech Plan — Clandestino"
createdAt: "2026-06-27T15:17:50.298Z"
updatedAt: "2026-06-27T15:18:44.555Z"
type: spec
---

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

| Decisão | Escolha | Rationale |
| --- | --- | --- |
| Monorepo | pnpm workspaces | Leve, resolve dependências locais nativamente, sem overhead de Turborepo no MVP |
| Frontend | React + Vite + TypeScript | SPA estática; sem SSR necessário para sistema interno |
| PWA/Offline | vite-plugin-pwa + Workbox + IndexedDB/Dexie | Fila de saída explícita para resultados; mais rastreável que cache otimista |
| API | Fastify + TypeBox | Validação de schema em runtime; rejeita placares impossíveis antes do banco |
| ORM | Drizzle | Schema próximo do SQL; migrações versionadas; tipagem end-to-end |
| Banco | PostgreSQL | Constraints relacionais impedem estados inválidos (ex.: dois seeds no mesmo grupo) |
| Tempo real | SSE (Server-Sent Events) | Unidirecional servidor→cliente; suficiente para atualizar classificação ao vivo |
| Sessão do jogador | Token local no IndexedDB | Sem conta formal; `player_id` + `edition_id` armazenados localmente; organizador corrige abusos |
| Auto-confirmação | `setInterval` no processo Fastify | Sem dependência externa; adequado para instância única no VPS |
| Deploy | Docker Compose + Caddy + Cloudflare | Alinhado com infraestrutura existente |

### Fluxo de uma requisição de registro de resultado (online)

```mermaid
sequenceDiagram
    participant App as PWA (Jogador)
    participant SW as Service Worker
    participant API as Fastify API
    participant Engine as tournament-engine
    participant DB as PostgreSQL

    App->>SW: POST /matches/:id/result
    SW->>API: encaminha (online)
    API->>Engine: validateMatchResult(result, rules)
    Engine-->>API: válido / inválido
    API->>DB: INSERT match_result; UPDATE match.status
    DB-->>API: confirmado
    API->>DB: recalculate standing (trigger ou chamada)
    API-->>App: 200 OK + novo status
    API-)App: SSE: standing_updated
```

### Fluxo offline → sincronização

```mermaid
sequenceDiagram
    participant App as PWA (Jogador)
    participant IDB as IndexedDB (fila)
    participant SW as Service Worker
    participant API as Fastify API

    App->>IDB: salva resultado com status AGUARDANDO_SINCRONIZAÇÃO
    App-->>App: exibe ícone de fila
    Note over SW: conexão restabelecida
    SW->>IDB: lê fila de saída
    SW->>API: POST /matches/:id/result
    API-->>SW: 200 OK
    SW->>IDB: remove da fila
    SW-->>App: notifica: resultado sincronizado
```

### Constraints que o banco deve garantir

- Um jogador não pode aparecer em dois grupos da mesma edição
- Não pode existir mais de uma partida entre os mesmos dois jogadores na mesma fase
- Uma partida não pode ter resultado sem participantes registrados
- Não pode existir mais de uma classificação final por edição

## 2. Modelo de Dados

### Entidades principais

```mermaid
classDiagram
    class player {
        id: uuid
        name: string
        created_at: timestamp
    }
    class season {
        id: uuid
        name: string
        scoring_table: jsonb
        created_at: timestamp
    }
    class edition {
        id: uuid
        season_id: uuid
        name: string
        date: date
        rules: jsonb
        status: enum
        auto_confirm_minutes: int
        created_at: timestamp
    }
    class draw_snapshot {
        id: uuid
        edition_id: uuid
        player_id: uuid
        accumulated_points: int
        rank_position: int
        is_seed: boolean
        algorithm: string
        random_seed: string
        drawn_at: timestamp
        drawn_by: string
    }
    class group {
        id: uuid
        edition_id: uuid
        name: string
        phase: string
    }
    class group_player {
        group_id: uuid
        player_id: uuid
    }
    class match {
        id: uuid
        edition_id: uuid
        group_id: uuid
        status: enum
        best_of: int
        created_at: timestamp
    }
    class match_participant {
        match_id: uuid
        player_id: uuid
        sets_won: int
    }
    class standing {
        id: uuid
        group_id: uuid
        player_id: uuid
        sets_won: int
        set_diff: int
        matches_won: int
        rank_in_group: int
    }
    class final_placement {
        id: uuid
        edition_id: uuid
        player_id: uuid
        position: int
        points_awarded: int
    }
    class audit_event {
        id: uuid
        edition_id: uuid
        match_id: uuid
        event_type: string
        payload: jsonb
        created_at: timestamp
        created_by: string
    }

    season "1" --> "*" edition
    edition "1" --> "*" draw_snapshot
    edition "1" --> "*" group
    edition "1" --> "*" final_placement
    group "1" --> "*" group_player
    group "1" --> "*" match
    group "1" --> "1" standing
    match "1" --> "*" match_participant
    player "1" --> "*" group_player
    player "1" --> "*" match_participant
    player "1" --> "*" draw_snapshot
    player "1" --> "*" final_placement
```

### Notas de modelagem

- **`edition.rules`** (jsonb): armazena `minimumGroupSize`, `preferredGroupSize`, `participantThresholdForBestOfThree`, `normalMatchBestOf`, `protectedSeedCount`, `groupRankingCriteria`
- **`season.scoring_table`** (jsonb): array de `{ position: number, points: number }`; posições não listadas recebem 0 ponto
- **`draw_snapshot`**: cópia imutável do ranking no momento do sorteio; inclui `algorithm`, `random_seed`, `drawn_by` para auditoria completa
- **`match.status`**: enum `AGENDADA | AGUARDANDO_CONFIRMACAO | CONFIRMADA | CONTESTADA | CORRIGIDA | CANCELADA`
- **`standing`**: recalculado pelo servidor a cada confirmação de resultado; nunca calculado no cliente
- **`audit_event`**: registra toda correção de resultado, cancelamento de sorteio e intervenção do organizador

## 3. Arquitetura de Componentes

### Mapa de componentes

```mermaid
graph TD
    subgraph packages
        TE[tournament-engine]
        SC[shared-contracts]
    end
    subgraph apps/api
        FW[Fastify Server]
        RT[Rotas REST]
        SSE[SSE Handler]
        JOB[Auto-confirm Job]
        DZ[Drizzle ORM]
    end
    subgraph apps/web
        RV[React + Vite]
        TQ[TanStack Query]
        DX[Dexie / IndexedDB]
        SW[Service Worker / Workbox]
        OQ[Fila de Saída Offline]
    end
    PG[(PostgreSQL)]

    SC --> TE
    SC --> FW
    SC --> RV
    TE --> RT
    RT --> DZ
    DZ --> PG
    SSE --> PG
    JOB --> DZ
    RV --> TQ
    TQ --> RT
    TQ --> OQ
    OQ --> SW
    SW --> RT
    DX --> SW
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
sequenceDiagram
    participant ClienteA as Jogador A (PWA)
    participant ClienteB as Público (browser)
    participant API as Fastify SSE
    participant DB as PostgreSQL

    ClienteA->>API: GET /editions/:id/events (SSE connect)
    ClienteB->>API: GET /editions/:id/events (SSE connect)
    Note over API: resultado confirmado
    API->>DB: UPDATE standing
    API-)ClienteA: event: standing_updated
    API-)ClienteB: event: standing_updated
    ClienteA->>API: GET /editions/:id/standing (refetch)
    ClienteB->>API: GET /editions/:id/standing (refetch)
```

### Limites de responsabilidade

| Responsabilidade | Onde vive |
| --- | --- |
| Validação de placar impossível | `tournament-engine` (puro) + Fastify (runtime) |
| Cálculo de classificação e desempate | `tournament-engine` (puro); resultado persistido pela API |
| Sorteio de grupos | `tournament-engine` (puro); resultado persistido e auditado pela API |
| Sessão do jogador | IndexedDB no cliente; servidor confia na declaração |
| Auto-confirmação por tempo | Job no processo Fastify (`setInterval`) |
| Atualização ao vivo | SSE unidirecional servidor→cliente |
| Fila offline | IndexedDB + Service Worker no cliente |
