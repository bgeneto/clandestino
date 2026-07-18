# Domain Taxonomy — Clandestino

This document defines the canonical domain vocabulary used across API, database, contracts, and UI.

## Hierarchy

```
Product (Clandestino)
  └── Championship / Campeonato
        ├── Ranking (accumulated points per player)
        ├── ScoringTable (points by final placement)
        ├── defaultEditionRules (optional defaults for new editions)
        └── Edition / Edição (dated event)
              ├── EditionRules (draw, groups, match format)
              ├── Registrations, Draw, Matches, Standings
              └── Final Placements → points roll up to Championship ranking
```

## Entities

### Product

**Clandestino** is the PWA brand for FitPong table tennis championships. It is not a persisted entity.

### Championship (`championship` table)

An ongoing named competition with its own accumulated ranking and settings.

Examples:

- Clandestino 2026 - Águas Claras
- Clandestino 2026 - Asa Sul
- Clandestino 2027 - Águas Claras

Owns:

- `scoringTable` — points awarded by final placement position
- `championship_player_points` — accumulated ranking per player
- `defaultEditionRules` — optional defaults inherited when creating editions
- Many `edition` rows

Portuguese UI label: **Campeonato**.

### Edition (`edition` table)

A single dated tournament event inside a championship (e.g. "Clandestino #1", 2026-07-04).

Edition names are assigned automatically by the server as `Clandestino #N`, where `N` reflects chronological order by `date` (tie-break: `createdAt`) within that championship (starting at 1). Names are renumbered after every create or delete that changes the date set. Organizers cannot set or change the name.

Owns:

- `rules` (`EditionRules`) — group sizes, seeding, placement format
- Lifecycle status (`RASCUNHO` → … → `ENCERRADA`)
- Registrations, groups, matches, group standings, final placements

Portuguese UI label: **Edição**.

### Player (`player` table)

A person registered globally (unique name). Participates in editions and accumulates points **per championship** via `championship_player_points`.

### Ranking

Accumulated points for a player within one championship. Stored in `championship_player_points`. Updated by:

- CSV import (`POST /championships/:id/import-scores`)
- Edition finalization (placement points added to ranking)

### ScoringTable

Championship-level configuration: how many points each final placement receives (1st, 2nd, …).

### EditionRules

Edition-level configuration for draw and match mechanics (group sizes, seeds, placement stage format). Stored on `edition.rules` as jsonb. Match scores are not format-locked (no best-of); the engine rejects ties, incomplete results (1×0), and absurd tallies.

The `@clandestino/tournament-engine` package implements pure functions that consume `EditionRules`; the package name is historical and refers to edition mechanics, not the championship entity.

### Edition lifecycle edge case — single group

When an edition has only one `GROUP_STAGE` group, completing all group matches sets status to `FASE_COLOCACAO` but creates zero `PLACEMENT_STAGE` groups (final positions come directly from group standings). The organizer finalizes the edition without publishing placement. The API rejects `POST /editions/:id/placement/publish` with 409 when there are no placement groups.

## API routes (organizer)

| Route                                   | Purpose                                    |
| --------------------------------------- | ------------------------------------------ |
| `GET/POST /championships`               | List / create championships                |
| `GET /championships/:id`                | Championship detail                        |
| `GET /championships/:id/editions`       | Editions in championship                   |
| `GET /championships/:id/ranking`        | Accumulated ranking                        |
| `PUT /championships/:id/scoring-table`  | Update scoring table                       |
| `POST /championships/:id/import-scores` | Import CSV ranking                         |
| `POST /editions`                        | Create edition (`championshipId` required) |

## UI routes (organizer)

| Route                                                 | Purpose             |
| ----------------------------------------------------- | ------------------- |
| `/organizador/painel`                                 | List championships  |
| `/organizador/campeonato/novo`                        | Create championship |
| `/organizador/campeonato/:championshipId`             | Championship hub    |
| `/organizador/campeonato/:championshipId/edicao/nova` | Create edition      |
| `/organizador/campeonato/:championshipId/importar`    | Import CSV          |
| `/organizador/edicao/:editionId`                      | Manage edition      |

## Deprecated names (historical)

Earlier prototypes used _season_ / _temporada_ in the database. The consolidated schema uses **championship** from the start; no rename migrations are shipped.
