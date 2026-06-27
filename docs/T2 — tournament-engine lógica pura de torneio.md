# T2 — tournament-engine: lógica pura de torneio

## Objetivo

Implementar o pacote `packages/tournament-engine` com todas as funções determinísticas de sorteio, validação e classificação, cobertas por testes property-based com Vitest + fast-check.

## Escopo

**Incluído:**

- Funções puras (sem I/O):

- `chooseGroupConfiguration(playerCount, rules)` — determina número e tamanho dos grupos
- `allocateSeededPlayers(seeds, groupCount)` — distribui seeds (1 por grupo, snake se múltiplos)
- `drawUnseededPlayers(players, groups, seed)` — sorteia demais jogadores com semente reproduzível
- `generateGroupMatches(group)` — gera todas as partidas round-robin do grupo

validateMatchResult(result, rules) — rejeita placares impossíveis (ex.: 2×2 em melhor de 3)

- `calculateGroupStanding(matches, rules)` — classifica jogadores com critérios de desempate
- `resolveTies(players, matches, criteria)` — aplica sets ganhos → saldo de sets → partidas vencidas
- `generatePlacementStage(groupStandings, rules)` — gera fase de colocação (round-robin ≥3, mata-mata =2)
- `calculateFinalStanding(placementResults)` — determina colocação final da edição

- Testes property-based com fast-check:
  - "Nenhum grupo tem dois seeds"
  - "Todo placar impossível é rejeitado"
  - "Classificação é determinística para a mesma entrada"
  - "Sorteio com mesma semente produz mesmo resultado"

**Excluído:** persistência, HTTP, UI

## Referências

- @c08f7f0d-4069-4916-bc47-e356d4d952f0/61be083b-ed4a-496b-af0d-1e236e80156c — Seção 3: `tournament-engine`
- @c08f7f0d-4069-4916-bc47-e356d4d952f0/ce1dfef5-af80-4c7e-8653-50072448b67b — Critérios de desempate, regras de grupos

## Dependências

- T1 (shared-contracts para tipos)

## Critérios de aceitação

- Todas as funções exportadas passam nos testes property-based
- `validateMatchResult` rejeita corretamente: 2×2 em melhor de 3, 3×3 em melhor de 5, vencedor com sets insuficientes
- `resolveTies` aplica a ordem: sets ganhos → saldo de sets → partidas vencidas
- `drawUnseededPlayers` com mesma semente produz resultado idêntico em execuções diferentes