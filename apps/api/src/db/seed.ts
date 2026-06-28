import 'dotenv/config';
import { DEFAULT_EDITION_RULES, DEFAULT_SCORING_TABLE } from '@clandestino/shared-contracts';
import { createDb, createSqlite, schema } from './index.js';

const playerIds = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000009',
  '00000000-0000-4000-8000-000000000010',
] as const;

const playerNames = [
  'ANA SOUZA',
  'BRUNO LIMA',
  'CARLA MENDES',
  'DANIEL ROCHA',
  'EDUARDO NUNES',
  'FERNANDA ALVES',
  'GABRIEL COSTA',
  'HELENA MARTINS',
  'IGOR RIBEIRO',
  'JULIANA FREITAS',
] as const;

const championshipAguasClaras2026Id = '10000000-0000-4000-8000-000000000001';
const championshipAsaSul2026Id = '10000000-0000-4000-8000-000000000002';
const championshipAguasClaras2027Id = '10000000-0000-4000-8000-000000000003';
const editionOpeningId = '20000000-0000-4000-8000-000000000001';
const editionWinterId = '20000000-0000-4000-8000-000000000002';
const groupAId = '30000000-0000-4000-8000-000000000001';
const groupBId = '30000000-0000-4000-8000-000000000002';

async function main() {
  const sqlite = createSqlite();
  const db = createDb(sqlite);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.players)
        .values(
          playerIds.map((id, index) => ({
            id,
            name: playerNames[index] ?? `Jogador ${index + 1}`,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.championships)
        .values([
          {
            id: championshipAsaSul2026Id,
            name: 'Clandestino 2026 - Asa Sul',
            scoringTable: DEFAULT_SCORING_TABLE,
          },
          {
            id: championshipAguasClaras2026Id,
            name: 'Clandestino 2026 - Águas Claras',
            scoringTable: DEFAULT_SCORING_TABLE,
          },
          {
            id: championshipAguasClaras2027Id,
            name: 'Clandestino 2027 - Águas Claras',
            scoringTable: DEFAULT_SCORING_TABLE,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(schema.editions)
        .values([
          {
            id: editionOpeningId,
            championshipId: championshipAsaSul2026Id,
            name: 'Clandestino #1',
            date: '2026-07-04',
            rules: DEFAULT_EDITION_RULES,
            status: 'SORTEIO_PUBLICADO',
            autoConfirmMinutes: 15,
          },
          {
            id: editionWinterId,
            championshipId: championshipAsaSul2026Id,
            name: 'Clandestino #2',
            date: '2026-08-01',
            rules: DEFAULT_EDITION_RULES,
            status: 'RASCUNHO',
            autoConfirmMinutes: 15,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(schema.editionRegistrations)
        .values(
          playerIds.map((playerId) => ({
            editionId: editionOpeningId,
            playerId,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.championshipPlayerPoints)
        .values(
          playerIds.map((playerId, index) => ({
            championshipId: championshipAsaSul2026Id,
            playerId,
            accumulatedPoints: Math.max(0, 220 - index * 18),
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.drawSnapshots)
        .values(
          playerIds.map((playerId, index) => ({
            id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            editionId: editionOpeningId,
            playerId,
            accumulatedPoints: Math.max(0, 220 - index * 18),
            rankPosition: index + 1,
            isSeed: index < DEFAULT_EDITION_RULES.protectedSeedCount,
            algorithm: 'seeded-balanced-v1',
            randomSeed: 'dev-seed-2026-opening',
            drawnBy: 'dev-seed',
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.groups)
        .values([
          {
            id: groupAId,
            editionId: editionOpeningId,
            name: 'Grupo A',
            phase: 'GROUP_STAGE',
          },
          {
            id: groupBId,
            editionId: editionOpeningId,
            name: 'Grupo B',
            phase: 'GROUP_STAGE',
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(schema.groupPlayers)
        .values(
          playerIds.map((playerId, index) => ({
            groupId: index < 5 ? groupAId : groupBId,
            editionId: editionOpeningId,
            playerId,
            isSeed: index < DEFAULT_EDITION_RULES.protectedSeedCount,
          })),
        )
        .onConflictDoNothing();

      const matchRows = [
        {
          id: '50000000-0000-4000-8000-000000000001',
          groupId: groupAId,
          playerOneId: playerIds[0],
          playerTwoId: playerIds[1],
          status: 'CONFIRMADA' as const,
        },
        {
          id: '50000000-0000-4000-8000-000000000002',
          groupId: groupAId,
          playerOneId: playerIds[2],
          playerTwoId: playerIds[3],
          status: 'AGENDADA' as const,
        },
        {
          id: '50000000-0000-4000-8000-000000000003',
          groupId: groupBId,
          playerOneId: playerIds[5],
          playerTwoId: playerIds[6],
          status: 'AGUARDANDO_CONFIRMACAO' as const,
        },
        {
          id: '50000000-0000-4000-8000-000000000004',
          groupId: groupBId,
          playerOneId: playerIds[7],
          playerTwoId: playerIds[8],
          status: 'AGENDADA' as const,
        },
      ];

      await tx
        .insert(schema.matches)
        .values(
          matchRows.map((match) => ({
            ...match,
            editionId: editionOpeningId,
            phase: 'GROUP_STAGE',
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.matchParticipants)
        .values(
          matchRows.flatMap((match, index) => [
            {
              matchId: match.id,
              playerId: match.playerOneId,
              setsWon: index === 0 ? 3 : 0,
            },
            {
              matchId: match.id,
              playerId: match.playerTwoId,
              setsWon: index === 0 ? 1 : 0,
            },
          ]),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.standings)
        .values(
          playerIds.map((playerId, index) => ({
            id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            groupId: index < 5 ? groupAId : groupBId,
            playerId,
            setsWon: index === 0 ? 3 : 0,
            setDiff: index === 0 ? 2 : index === 1 ? -2 : 0,
            matchesWon: index === 0 ? 1 : 0,
            rankInGroup: (index % 5) + 1,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.finalPlacements)
        .values(
          playerIds.slice(0, 3).map((playerId, index) => ({
            id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            editionId: editionOpeningId,
            playerId,
            position: index + 1,
            pointsAwarded: DEFAULT_SCORING_TABLE[index]?.points ?? 0,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(schema.auditEvents)
        .values({
          id: '80000000-0000-4000-8000-000000000001',
          editionId: editionOpeningId,
          eventType: 'DRAW_EXECUTED',
          payload: {
            randomSeed: 'dev-seed-2026-opening',
            groups: 2,
            players: playerIds.length,
          },
          createdBy: 'dev-seed',
        })
        .onConflictDoNothing();
    });

    console.log('Development seed completed.');
  } finally {
    sqlite.close();
  }
}

await main();
