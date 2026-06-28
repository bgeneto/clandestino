# PERGUNTA

Na academia de tênis de mesa "FitPong" temos um campeonato semanal chamado "Clandestino". A pontuação de cada jogador é contabilizada por sets ganhos (as partidas podem ser melhor de 3 ou 5 sets, dependendo da quantidade de jogadores nos grupos, se houver muitos jogadores - considerados acima de um limiar estabelecido - as partidas serão disputadas em três sets (melhor de 3). Dependendo do número de participantes nós dividimos em dois, três ou mais grupos (de no mínimo 4 jogadores cada). Depois os primeiros colocados de cada grupo disputam entre si e assim por diante... Até estabelecer as colocações/pontuações finais de cada jogador naquele dia.

Atualmente tudo isso é feito no papel, em que cada jogador anota o resultado de sua própria partida numa tabela.

Você acredita que seria interessante desenvolver um aplicativo para substituir o papel? Incluindo o sorteio dos grupos considerando os cabeças-de-chave (melhores jogadores não são sorteados, são colocados em grupos diferentes). Qual tech stack você recomendaria Neste caso?

## Sim — neste caso o aplicativo faz bastante sentido

Como o **Clandestino ocorre semanalmente**, há um processo repetitivo, regras relativamente bem definidas e produção contínua de dados. O aplicativo não apenas substituiria o papel: ele poderia eliminar boa parte do trabalho manual de organização, reduzir erros de classificação e formar um histórico esportivo útil para os próximos sorteios.

Os principais ganhos seriam:

- sorteio automático e auditável dos grupos;
- detecção automática dos cabeças de chave pela pontuação geral do campeonato (quando possível);
- distribuição equilibrada dos cabeças de chave;
- geração automática das partidas;
- validação dos placares conforme o formato da partida;
- classificação atualizada imediatamente;
- cálculo automático dos critérios de desempate;
- geração das fases de colocação;
- classificação final do torneio;
- atualização do ranking geral do Cladestino;
- histórico individual de participações, partidas e sets;
- possibilidade de acompanhar o torneio em tempo real pelo celular.

Eu não começaria com um aplicativo nativo para Android e iOS. Para esse cenário, desenvolveria um **Aplicativo Web Progressivo — PWA**, instalável no celular e utilizável pelo navegador. Uma PWA pode ser adicionada à tela inicial e, com um trabalhador de serviço (_service worker_) e armazenamento local, continuar operacional mesmo durante interrupções da conexão. ([MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation?utm_source=chatgpt.com))

---

# Arquitetura que recomendo

## Stack principal

| Camada                    | Tecnologia recomendada               |
| ------------------------- | ------------------------------------ |
| Linguagem                 | TypeScript                           |
| Interface                 | React + Vite                         |
| PWA                       | `vite-plugin-pwa`/Workbox            |
| Componentes               | Tailwind CSS + shadcn/ui             |
| Estado remoto             | TanStack Query                       |
| Armazenamento local       | IndexedDB + Dexie                    |
| API                       | Node.js + Fastify                    |
| Validação                 | TypeBox + JSON Schema                |
| Banco                     | PostgreSQL                           |
| Acesso ao banco           | Drizzle ORM                          |
| Atualização em tempo real | Eventos enviados pelo servidor — SSE |
| Testes                    | Vitest + Playwright + `fast-check`   |
| Implantação               | Docker Compose + Caddy no seu VPS    |
| DNS e proteção            | Cloudflare                           |

Essa combinação se encaixa bem com a infraestrutura que você já utiliza: **Node.js, PostgreSQL, Docker, Debian, Caddy e Cloudflare**.

### Por que React com Vite, e não Next.js?

Este é essencialmente um sistema operacional interno, não um portal que dependa de otimização para mecanismos de busca ou renderização no servidor. Com Vite, a interface pode ser publicada como arquivos estáticos, deixando o Fastify responsável exclusivamente pela API.

O Vite possui suporte direto a TypeScript, enquanto o ecossistema `vite-plugin-pwa` permite gerar o trabalhador de serviço e o cache da aplicação por meio do Workbox. ([vitejs](https://vite.dev/guide/?utm_source=chatgpt.com))

Next.js também funcionaria, mas acrescentaria complexidade desnecessária para a primeira versão.

### Por que Fastify?

Para este projeto, eu manteria sua preferência por um **monólito modular em Node.js**. Fastify oferece boa organização por módulos, integração com TypeScript e validação de requisições e respostas por JSON Schema. Isso é especialmente útil para rejeitar resultados impossíveis antes que eles alcancem o banco. ([Fastify](https://fastify.dev/docs/latest/Reference/TypeScript/?utm_source=chatgpt.com))

### Por que PostgreSQL?

O banco deve ser a fonte definitiva dos resultados. Restrições de chave primária, unicidade, referência e verificação podem impedir situações como:

- um jogador aparecer duas vezes no mesmo grupo;
- existir mais de uma partida entre os mesmos jogadores na mesma fase;
- registrar uma partida sem seus participantes;
- publicar duas classificações finais para a mesma edição;
- apagar um jogador que já possui partidas registradas.

O PostgreSQL oferece essas garantias diretamente no modelo relacional. ([PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html?utm_source=chatgpt.com))

> **Nota (2026):** a API foi migrada para **SQLite** (`better-sqlite3` + Drizzle). A decisão original favorecia PostgreSQL; o MVP passou a usar arquivo local com as mesmas constraints Drizzle.

O Drizzle é uma boa escolha por manter o esquema próximo do SQL, preservar a tipagem no TypeScript e gerar migrações versionadas. ([Drizzle ORM](https://orm.drizzle.team/docs/get-started/sqlite-new?utm_source=chatgpt.com))

---

# O componente mais importante: o motor de torneios

Eu não colocaria a lógica de sorteio e classificação diretamente dentro dos controladores da API. Criaria uma biblioteca TypeScript independente, por exemplo:

```text
packages/
  tournament-engine/
  shared-contracts/
apps/
  web/
  api/
```

O `tournament-engine` seria uma biblioteca determinística e sem dependência de banco de dados, contendo funções como:

```ts
chooseGroupConfiguration();
allocateSeededPlayers();
drawUnseededPlayers();
generateGroupMatches();
validateMatchResult();
calculateGroupStanding();
resolveTies();
generatePlacementStage();
calculateFinalStanding();
```

Isso é importante porque permite testar centenas ou milhares de combinações de participantes antes de utilizar o sistema em um campeonato real.

O mesmo motor pode ser executado no servidor e parcialmente no navegador, mas o **servidor sempre recalcularia e validaria a classificação oficial**.

---

# Modelagem das regras

O aplicativo não deve codificar permanentemente algo como “acima de 24 jogadores, melhor de três”. As regras precisam ser configuráveis e associadas a cada edição.

Um conjunto de regras poderia conter:

```ts
type TournamentRules = {
  minimumGroupSize: number;
  preferredGroupSize: number;
  maximumGroupSize: number;

  participantThresholdForBestOfThree: number;
  normalMatchBestOf: 3 | 5;

  protectedSeedCount: number;
  seedingMethod: 'fixed-heads' | 'snake' | 'pots';

  groupRankingCriteria: RankingCriterion[];
  placementStageFormat: 'round-robin' | 'knockout';
};
```

A regra do número de sets seria validada assim:

- melhor de três: vence quem alcançar **dois sets**;
- melhor de cinco: vence quem alcançar **três sets**;
- resultados como `2 × 2`, `3 × 3` ou `3 × 2` em melhor de três seriam rejeitados.

---

# Formação dos grupos

Uma estratégia adequada seria:

1. Determinar quantos grupos podem ser formados respeitando o mínimo de quatro jogadores.
2. Procurar a distribuição com grupos de tamanhos tão próximos quanto possível.
3. Separar os cabeças de chave.
4. Colocar pelo menos um cabeça de chave em cada grupo.
5. Distribuir os demais jogadores aleatoriamente.
6. Registrar a semente aleatória utilizada no sorteio.
7. Publicar o resultado e impedir alterações silenciosas.

Por exemplo, com três grupos:

```text
Grupo A: cabeça de chave 1
Grupo B: cabeça de chave 2
Grupo C: cabeça de chave 3
```

Os demais podem ser efetivamente sorteados. Caso existam mais jogadores protegidos, pode-se utilizar distribuição em serpentina:

```text
1 → A
2 → B
3 → C
4 → C
5 → B
6 → A
```

Para que o sorteio seja transparente, eu armazenaria:

```text
algoritmo utilizado
versão do algoritmo
semente aleatória
ranking considerado
data e responsável pelo sorteio
resultado completo
```

Dessa maneira, o sorteio pode ser reproduzido posteriormente.

---

# Fases de colocação

Pela descrição do Cladestino, o sistema parece utilizar **grupos de colocação**:

- primeiros colocados de cada grupo disputam as primeiras posições;
- segundos colocados disputam as posições seguintes;
- terceiros colocados fazem o mesmo;
- e assim sucessivamente.

Eu modelaria isso genericamente como `placement_stage`, em vez de criar campos específicos como “fase dos primeiros”.

Exemplo com três grupos de cinco jogadores:

```text
Fase de colocação 1:
1º do A, 1º do B, 1º do C
→ posições finais 1 a 3

Fase de colocação 2:
2º do A, 2º do B, 2º do C
→ posições finais 4 a 6

Fase de colocação 3:
3º do A, 3º do B, 3º do C
→ posições finais 7 a 9
```

Essa modelagem também permite acomodar futuramente:

- semifinal e final;
- eliminatória simples;
- grupos ouro, prata e bronze;
- repescagem;
- disputa específica de terceiro lugar.

---

# Critérios de classificação e desempate

Esta é uma regra que deve ser formalizada antes da implementação.

Se a pontuação principal é o **total de sets ganhos**, o sistema ainda precisa saber o que fazer quando dois jogadores terminam empatados. Uma ordem possível seria:

1. sets ganhos;
2. confronto direto;
3. saldo de sets;
4. pontos ganhos menos pontos perdidos;
5. maior número de partidas vencidas;
6. sorteio ou decisão do organizador.

Entretanto, não se deve presumir essa sequência. O aplicativo deve reproduzir exatamente a regra já adotada pela Fitpong.

Também é importante distinguir:

- **sets ganhos na fase**;
- **saldo de sets**;
- **partidas vencidas**;
- **pontuação do campeonato na semana**;
- **pontuação acumulada no ranking da temporada**.

Essas grandezas não devem ser armazenadas em uma única coluna chamada `pontuacao`.

---

# Registro dos resultados

Eu adotaria este fluxo:

1. O jogador abre o evento por um código ou código QR.
2. Visualiza apenas suas partidas e a classificação pública.
3. Seleciona uma partida.
4. Informa o resultado.
5. O adversário confirma.
6. A classificação é recalculada.
7. Eventuais alterações posteriores ficam registradas no histórico.

Estados possíveis:

```text
AGENDADA
EM_ANDAMENTO
AGUARDANDO_CONFIRMACAO
CONFIRMADA
CONTESTADA
CORRIGIDA
CANCELADA
```

Para reduzir atrito, o MVP pode registrar apenas:

```text
Jogador A: 3 sets
Jogador B: 1 set
```

Uma versão posterior pode registrar cada set:

```text
11 × 7
8 × 11
11 × 5
11 × 9
```

O detalhamento por pontos melhora as estatísticas, mas torna o preenchimento mais demorado. Eu o deixaria opcional inicialmente.

---

# Funcionamento sem internet

Este requisito é importante dentro de uma academia, onde o sinal pode oscilar.

A interface manteria no IndexedDB:

- participantes da edição;
- grupos;
- partidas;
- resultados já sincronizados;
- fila de resultados ainda não enviados;
- versão atual da classificação.

Ao registrar um resultado sem conexão:

```text
resultado salvo localmente
        ↓
marcado como “aguardando sincronização”
        ↓
conexão restabelecida
        ↓
resultado enviado à API
        ↓
servidor valida e confirma
```

O TanStack Query possui mecanismos para persistência de cache e retomada de mutações pausadas; ainda assim, eu usaria uma **fila de saída explícita** no IndexedDB, porque resultados esportivos exigem rastreabilidade maior do que uma simples atualização otimista de interface. ([tanstack.com](https://tanstack.com/query/latest/docs/framework/preact/plugins/persistQueryClient?utm_source=chatgpt.com))

---

# Modelo de dados inicial

As principais entidades seriam:

```text
player
ranking_snapshot
tournament
tournament_rules
tournament_registration
group
group_player
stage
match
match_participant
match_result
match_set
standing
final_placement
audit_event
```

Uma distinção importante:

- `ranking_snapshot` registra o ranking utilizado no momento do sorteio;
- `standing` representa uma classificação calculada dentro de uma fase;
- `final_placement` representa a posição oficial daquela edição;
- o ranking atual não deve ser usado para reinterpretar retrospectivamente sorteios antigos.

---

# Perfis de acesso

Eu usaria três perfis simples.

### Organizador

Pode cadastrar participantes, executar o sorteio, abrir e encerrar fases, corrigir resultados e homologar a classificação.

### Jogador

Pode visualizar o torneio e registrar resultados das partidas em que participa.

### Público

Pode apenas acompanhar grupos, resultados e classificação.

No início, os jogadores não precisam criar uma conta convencional. Uma solução melhor seria:

- código QR do evento;
- seleção do nome;
- código pessoal curto;
- sessão válida apenas para aquela edição.

O organizador utilizaria autenticação mais forte.

---

# Escopo recomendado para o MVP

## Primeira versão

Eu implementaria somente:

- cadastro de jogadores;
- criação da edição do dia/semana;
- inscrição dos participantes;
- ranking utilizado como referência;
- configuração do número de grupos;
- proteção dos cabeças de chave;
- sorteio dos demais jogadores;
- geração das partidas;
- entrada de resultados;
- classificação automática dos grupos;
- geração das fases de colocação;
- classificação final;
- tela pública;
- histórico de alterações;
- exportação para CSV e impressão.

Nesta fase, o organizador pode ser o único usuário autorizado a confirmar resultados.

## Segunda versão

Depois de validar o funcionamento real:

- entrada de resultados pelos próprios jogadores;
- confirmação pelo adversário;
- funcionamento completo sem conexão;
- códigos QR;
- atualização em tempo real;
- ranking acumulado;
- estatísticas individuais;
- histórico de confrontos.

## Terceira versão

Somente após existir uso recorrente:

- reserva de mesas;
- definição automática da próxima partida disponível;
- chamada dos jogadores;
- notificações;
- cronômetro;
- previsão da duração da rodada;
- suporte a outros formatos de campeonato;
- uso por outras academias.

---

# Minha recomendação final

Desenvolveria o sistema como:

```text
React + Vite + TypeScript
        ↓
PWA com IndexedDB/Dexie
        ↓
API REST Fastify
        ↓
motor de torneios independente
        ↓
PostgreSQL + Drizzle
        ↓
Docker Compose + Caddy no VPS
```

Não utilizaria inicialmente:

- aplicativo Android/iOS nativo;
- microsserviços;
- Kubernetes;
- Redis;
- GraphQL;
- inteligência artificial;
- arquitetura excessivamente genérica para qualquer modalidade esportiva.

O melhor produto inicial seria um **sistema específico para o regulamento do Cladestino**, mas com regras configuráveis e um motor de torneios suficientemente isolado para evoluir posteriormente. Antes da codificação, o passo mais importante é transformar o regulamento informal atual em uma especificação determinística, principalmente quanto à formação dos grupos, critérios de desempate, fases de colocação e cálculo do ranking acumulado.
