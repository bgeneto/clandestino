import { describe, expect, it } from 'vitest';
import type { Edition } from '@clandestino/shared-contracts';
import { DEFAULT_EDITION_RULES } from '@clandestino/shared-contracts';
import { mergeCreatedEditions } from './championship-query-cache.js';

const championshipId = '11111111-1111-4111-8111-111111111111';

function edition(id: string, date: string, createdAt: string): Edition {
  return {
    id,
    championshipId,
    name: `Clandestino ${date}`,
    date,
    rules: DEFAULT_EDITION_RULES,
    status: 'RASCUNHO',
    autoConfirmMinutes: 15,
    syncRevision: 0,
    createdAt,
  };
}

describe('championship query cache', () => {
  it('inclui imediatamente edições criadas, sem duplicar e mantendo a ordem da API', () => {
    const older = edition(
      '22222222-2222-4222-8222-222222222222',
      '2026-07-03',
      '2026-07-03T10:00:00.000Z',
    );
    const created = edition(
      '33333333-3333-4333-8333-333333333333',
      '2026-07-10',
      '2026-07-10T10:00:00.000Z',
    );

    const merged = mergeCreatedEditions({ championshipId, editions: [older] }, championshipId, [
      created,
      created,
    ]);

    expect(merged.editions.map((entry) => entry.id)).toEqual([created.id, older.id]);
  });
});
