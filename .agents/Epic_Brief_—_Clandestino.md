---
id: "ce1dfef5-af80-4c7e-8653-50072448b67b"
title: "Epic Brief — Clandestino"
createdAt: "2026-06-27T14:29:10.804Z"
updatedAt: "2026-06-27T14:53:08.789Z"
type: spec
---

# Epic Brief — Clandestino

## Resumo

O **Clandestino** é um sistema web progressivo (PWA) para gerenciar o campeonato semanal de tênis de mesa da academia **FitPong**. Hoje todo o processo — sorteio de grupos, registro de partidas e apuração de classificação — é feito em papel, o que gera erros, retrabalho e ausência de histórico. O sistema substituirá o papel por um app mobile-first, acessível via QR code, que automatiza o sorteio, valida resultados em tempo real e mantém um ranking acumulado da temporada. O MVP entrega o ciclo completo de uma edição semanal, com suporte offline obrigatório, e serve como base para versões futuras com estatísticas avançadas e suporte a múltiplas academias.

## Contexto e Problema

### Quem é afetado

| Perfil | Dor atual |
| --- | --- |
| **Organizador** | Monta grupos manualmente, calcula desempates à mão, corrige erros de anotação, não tem histórico auditável |
| **Jogadores** | Dependem do organizador para saber sua classificação; não têm visibilidade em tempo real |
| **Público** | Não consegue acompanhar o torneio remotamente |

### Onde acontece

Dentro da academia FitPong, durante o torneio semanal "Clandestino", com 12–20 participantes por edição. O sinal de internet é instável, tornando o funcionamento offline um requisito crítico desde o MVP.

### Problema central

O processo atual é inteiramente manual e não escalável:

- Sorteio de grupos feito sem garantia de distribuição equilibrada dos cabeças de chave
- Resultados anotados em papel, sujeitos a erros e rasuras
- Classificação calculada manualmente, sem critérios de desempate formalizados
- Nenhum histórico digital de partidas, colocações ou ranking acumulado

## Decisões-chave já alinhadas

- **Critérios de desempate** (em todas as fases): sets ganhos → saldo de sets → partidas vencidas
- **Seeds:** sempre 1 por grupo; identificados pelo ranking acumulado da temporada
- **Ranking acumulado:** pontos por colocação — o sistema sugere por padrão a tabela 1º=200, 2º=180, 3º=160, 4º=140, 5º=100, 6º=90, 7º=80, 8º=70, 9º=50, 10º=45, 11º=40, 12º=35, 13º=20, 14º=15, 15º=10, 16º=5, 17º=4, 18º=3, 19º=2, 20º=1; do 21º lugar em diante, 0 ponto; a tabela padrão pode ser editada por temporada
- **Fase de colocação:** round-robin se ≥ 3 classificados; mata-mata se = 2; gerada automaticamente quando todas as partidas de grupos forem confirmadas, com publicação pelo organizador
- **Registro de resultado:** placar de sets apenas (ex.: 3×1); adversário confirma; contestação vai ao organizador; se o organizador corrigir, o resultado já vira oficial
- **Auto-confirmação por tempo:** configurável pelo organizador em cada edição, com valor padrão sugerido pelo sistema
- **Acesso do jogador:** QR code do evento → seleciona o nome → confirma que escolheu o nome correto → entra sem senha
- **Acesso do organizador:** magic link por e-mail
- **Offline:** fila de saída explícita no IndexedDB; sincronização automática ao reconectar
- **Importação inicial:** CSV com pontuação acumulada da temporada atual (operação única)

## Critérios de sucesso do MVP

- Rodar várias edições seguidas sem voltar ao processo manual em papel
- Conseguir usar o ranking importado já no primeiro sorteio oficial

## Fora do escopo do MVP

- Exportação CSV / impressão
- Estatísticas individuais e histórico de confrontos
- Notificações push, cronômetro, reserva de mesas
- Suporte a outras academias ou outros formatos de campeonato
- Detalhamento de pontos por set
