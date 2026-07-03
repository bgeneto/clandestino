import 'dotenv/config';
import { DEFAULT_SCORING_TABLE } from '@clandestino/shared-contracts';
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
const championshipAguasClaras2027Id = '10000000-0000-4000-8000-000000000003';

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
    });

    console.log('Development seed completed.');
  } finally {
    sqlite.close();
  }
}

await main();
