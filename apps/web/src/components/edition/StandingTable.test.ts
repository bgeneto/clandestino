import type { Match, Standing } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import {
  buildCombinedStandingsRows,
  buildGroupStandingsRows,
  countMatchesPlayedByPlayer,
} from './StandingTable.js';

function standing(playerId: string, setsWon: number, matchesWon: number): Standing {
  return {
    id: `standing-${playerId}-${setsWon}`,
    groupId: 'group-x',
    playerId,
    setsWon,
    setDiff: 0,
    matchesWon,
    rankInGroup: 1,
  };
}

function confirmedMatch(
  groupId: string,
  playerOneId: string,
  playerTwoId: string,
  status: Match['status'] = 'CONFIRMADA',
): Pick<Match, 'participants' | 'status' | 'groupId'> {
  return {
    groupId,
    status,
    participants: [
      { playerId: playerOneId, setsWon: 0 },
      { playerId: playerTwoId, setsWon: 0 },
    ],
  };
}

describe('countMatchesPlayedByPlayer', () => {
  it('conta apenas CONFIRMADA e CORRIGIDA', () => {
    const counts = countMatchesPlayedByPlayer([
      confirmedMatch('g1', 'p1', 'p2', 'CONFIRMADA'),
      confirmedMatch('g1', 'p1', 'p3', 'CORRIGIDA'),
      confirmedMatch('g1', 'p1', 'p4', 'AGENDADA'),
      confirmedMatch('g1', 'p1', 'p5', 'AGUARDANDO_CONFIRMACAO'),
    ]);

    expect(counts.get('p1')).toBe(2);
    expect(counts.get('p2')).toBe(1);
    expect(counts.get('p3')).toBe(1);
    expect(counts.get('p4')).toBeUndefined();
  });

  it('ignora partidas de grupos desconhecidos quando groupIds é informado', () => {
    const counts = countMatchesPlayedByPlayer(
      [confirmedMatch('g1', 'p1', 'p2'), confirmedMatch('other', 'p1', 'p3')],
      ['g1'],
    );

    expect(counts.get('p1')).toBe(1);
    expect(counts.get('p3')).toBeUndefined();
  });
});

describe('buildCombinedStandingsRows', () => {
  it('retorna uma linha por jogador quando há apenas um grupo', () => {
    const rows = buildCombinedStandingsRows({
      standings: [
        {
          groupId: 'g1',
          standings: [standing('p1', 6, 3), standing('p2', 3, 1), standing('p3', 0, 0)],
        },
      ],
      groupIds: ['g1'],
      playerNames: new Map([
        ['p1', 'AMANDA'],
        ['p2', 'ADRIANO'],
        ['p3', 'BERNHARD'],
      ]),
      matches: [],
    });

    expect(rows.map((row) => row.playerId)).toEqual(['p1', 'p2', 'p3']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.setsWon)).toEqual([6, 3, 0]);
  });

  it('consolida duas fases em uma linha por jogador (cenário do bug)', () => {
    // Reproduz o cenário da screenshot do bug: 6 jogadores com fase de
    // grupos + fase de colocação. Cada jogador tem 1 standing por fase,
    // totalizando 12 entradas que devem virar 6 linhas.
    const rows = buildCombinedStandingsRows({
      standings: [
        // Fase de grupos: Grupo A (AMANDA, FABIANO, FERNANDO)
        {
          groupId: 'group-a',
          standings: [
            standing('amanda', 6, 2),
            standing('fabiano', 4, 1),
            standing('fernando', 4, 0),
          ],
        },
        // Fase de grupos: Grupo B (ADRIANO, CLÁUDIO, BERNHARD)
        {
          groupId: 'group-b',
          standings: [
            standing('adriano', 5, 1),
            standing('claudio', 4, 2),
            standing('bernhard', 1, 0),
          ],
        },
        // Fase de colocação: 1º-2º (AMANDA, ADRIANO)
        {
          groupId: 'place-1-2',
          standings: [standing('amanda', 3, 1), standing('adriano', 1, 0)],
        },
        // Fase de colocação: 3º-4º (CLÁUDIO, FABIANO)
        {
          groupId: 'place-3-4',
          standings: [standing('claudio', 3, 1), standing('fabiano', 0, 0)],
        },
        // Fase de colocação: 5º-6º (BERNHARD, FERNANDO)
        {
          groupId: 'place-5-6',
          standings: [standing('bernhard', 3, 1), standing('fernando', 2, 0)],
        },
      ],
      groupIds: ['group-a', 'group-b', 'place-1-2', 'place-3-4', 'place-5-6'],
      playerNames: new Map([
        ['amanda', 'AMANDA'],
        ['adriano', 'ADRIANO'],
        ['claudio', 'CLÁUDIO'],
        ['fabiano', 'FABIANO'],
        ['fernando', 'FERNANDO'],
        ['bernhard', 'BERNHARD'],
      ]),
      matches: [],
    });

    // Antes da correção: 12 linhas. Depois: 6 linhas, uma por jogador.
    expect(rows).toHaveLength(6);

    // Somas dos sets (grupo + colocação) por jogador:
    //   AMANDA  6 + 3 = 9
    //   ADRIANO 5 + 1 = 6
    //   CLÁUDIO 4 + 3 = 7
    //   FABIANO 4 + 0 = 4
    //   FERNANDO 4 + 2 = 6
    //   BERNHARD 1 + 3 = 4
    // Ordenado por setsWon desc, com matchesWon como desempate:
    //   AMANDA (9, 3) > CLÁUDIO (7, 3) > ADRIANO (6, 1) > FERNANDO (6, 0)
    //   > BERNHARD (4, 1) > FABIANO (4, 1) — empate, ordem alfabética
    expect(rows.map((row) => row.playerId)).toEqual([
      'amanda',
      'claudio',
      'adriano',
      'fernando',
      'bernhard',
      'fabiano',
    ]);

    expect(rows.map((row) => row.setsWon)).toEqual([9, 7, 6, 6, 4, 4]);
    expect(rows.map((row) => row.matchesWon)).toEqual([3, 3, 1, 0, 1, 1]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('não duplica jogadores quando há standings em grupos não presentes em groupIds', () => {
    const rows = buildCombinedStandingsRows({
      standings: [
        { groupId: 'g1', standings: [standing('p1', 6, 3), standing('p2', 3, 1)] },
        { groupId: 'unknown-group', standings: [standing('p1', 5, 2)] },
      ],
      groupIds: ['g1'],
      playerNames: new Map([
        ['p1', 'AMANDA'],
        ['p2', 'ADRIANO'],
      ]),
      matches: [],
    });

    // Standings de 'unknown-group' são ignorados (defesa contra cache).
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.playerId === 'p1')?.setsWon).toBe(6);
  });

  it('ordena por setsWon desc, com matchesWon como desempate e nome como último critério', () => {
    const rows = buildCombinedStandingsRows({
      standings: [{ groupId: 'g1', standings: [standing('beta', 4, 1), standing('alpha', 4, 1)] }],
      groupIds: ['g1'],
      playerNames: new Map([
        ['alpha', 'ALPHA'],
        ['beta', 'BETA'],
      ]),
      matches: [],
    });

    // Empate em setsWon (4) e matchesWon (1) → ordem alfabética estável.
    expect(rows.map((row) => row.playerId)).toEqual(['alpha', 'beta']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  it('retorna array vazio quando não há standings', () => {
    expect(
      buildCombinedStandingsRows({
        standings: [],
        groupIds: ['g1'],
        playerNames: new Map(),
        matches: [],
      }),
    ).toEqual([]);
  });

  it('preenche playerName como "Jogador" quando o nome não está no mapa', () => {
    const rows = buildCombinedStandingsRows({
      standings: [{ groupId: 'g1', standings: [standing('p1', 5, 1)] }],
      groupIds: ['g1'],
      playerNames: new Map(),
      matches: [],
    });

    expect(rows[0]?.playerName).toBe('Jogador');
  });

  it('soma matchesWon mesmo quando setsWon é igual entre fases', () => {
    const rows = buildCombinedStandingsRows({
      standings: [
        { groupId: 'g1', standings: [standing('p1', 4, 2)] },
        { groupId: 'g2', standings: [standing('p1', 4, 1)] },
      ],
      groupIds: ['g1', 'g2'],
      playerNames: new Map([['p1', 'AMANDA']]),
      matches: [],
    });

    expect(rows[0]?.setsWon).toBe(8);
    expect(rows[0]?.matchesWon).toBe(3);
  });

  it('mostra no detail o total de partidas jogadas, não vitórias', () => {
    // Eduardo: 1 vitória (matchesWon=1) e 3 partidas confirmadas.
    const rows = buildCombinedStandingsRows({
      standings: [{ groupId: 'g1', standings: [standing('eduardo', 5, 1)] }],
      groupIds: ['g1'],
      playerNames: new Map([['eduardo', 'EDUARDO']]),
      matches: [
        confirmedMatch('g1', 'eduardo', 'bernhard'),
        confirmedMatch('g1', 'eduardo', 'denilson'),
        confirmedMatch('g1', 'eduardo', 'lucas'),
      ],
    });

    expect(rows[0]?.matchesWon).toBe(1);
    expect(rows[0]?.matchesPlayed).toBe(3);
    expect(rows[0]?.detail).toBe('3 partidas');
  });

  it('usa singular no detail quando há exatamente uma partida', () => {
    const rows = buildCombinedStandingsRows({
      standings: [{ groupId: 'g1', standings: [standing('p1', 3, 1)] }],
      groupIds: ['g1'],
      playerNames: new Map([['p1', 'AMANDA']]),
      matches: [confirmedMatch('g1', 'p1', 'p2')],
    });

    expect(rows[0]?.detail).toBe('1 partida');
  });
});

describe('buildGroupStandingsRows', () => {
  it('renderiza standings por rankInGroup e marca seeds com detail', () => {
    const rows = buildGroupStandingsRows({
      groupId: 'g1',
      standings: [
        { ...standing('p1', 6, 3), rankInGroup: 1 },
        { ...standing('p2', 3, 1), rankInGroup: 2 },
      ],
      playerNames: new Map([
        ['p1', 'AMANDA'],
        ['p2', 'ADRIANO'],
      ]),
      participants: [
        {
          playerId: 'p1',
          playerName: 'AMANDA',
          rankPosition: 1,
          accumulatedPoints: 0,
          isSeed: true,
        },
        {
          playerId: 'p2',
          playerName: 'ADRIANO',
          rankPosition: 2,
          accumulatedPoints: 0,
          isSeed: false,
        },
      ],
    });

    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
    expect(rows[0]?.detail).toBe('SEED');
    expect(rows[1]?.detail).toBeUndefined();
  });
});
