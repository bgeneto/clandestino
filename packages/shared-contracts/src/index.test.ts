import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import {
  CreateEditionBodySchema,
  DEFAULT_SCORING_TABLE,
  DEFAULT_EDITION_RULES,
  ExecuteDrawBodySchema,
  MatchSchema,
  MatchStatusSchema,
  PlayerSchema,
  EditionRulesSchema,
  formatEditionName,
} from './index.js';

describe('shared-contracts schemas', () => {
  it('exports all MatchStatus values', () => {
    const statuses = [
      'AGENDADA',
      'AGUARDANDO_CONFIRMACAO',
      'CONFIRMADA',
      'CONTESTADA',
      'CORRIGIDA',
      'CANCELADA',
    ] as const;

    for (const status of statuses) {
      expect(Value.Check(MatchStatusSchema, status)).toBe(true);
    }
  });

  it('validates a player entity', () => {
    const player = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Bruno Lima',
      createdAt: '2026-06-27T12:00:00.000Z',
    };

    expect(Value.Check(PlayerSchema, player)).toBe(true);
  });

  it('validates tournament rules with defaults', () => {
    expect(Value.Check(EditionRulesSchema, DEFAULT_EDITION_RULES)).toBe(true);
  });

  it('validates match entity shape including outcome', () => {
    const match = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      editionId: '550e8400-e29b-41d4-a716-446655440002',
      groupId: '550e8400-e29b-41d4-a716-446655440003',
      status: 'AGENDADA',
      outcome: 'PLAYED',
      participants: [
        { playerId: '550e8400-e29b-41d4-a716-446655440004', setsWon: 0 },
        { playerId: '550e8400-e29b-41d4-a716-446655440005', setsWon: 0 },
      ],
      createdAt: '2026-06-27T12:00:00.000Z',
      updatedAt: '2026-06-27T12:00:00.000Z',
    };

    expect(Value.Check(MatchSchema, match)).toBe(true);
  });

  it('validates edition creation body', () => {
    const body = {
      championshipId: '550e8400-e29b-41d4-a716-446655440010',
      date: '2026-06-27',
      rules: DEFAULT_EDITION_RULES,
      autoConfirmMinutes: 15,
    };

    expect(Value.Check(CreateEditionBodySchema, body)).toBe(true);
  });

  it('provides a 20-position default scoring table', () => {
    expect(DEFAULT_SCORING_TABLE).toHaveLength(20);
    expect(DEFAULT_SCORING_TABLE[0]).toEqual({ position: 1, points: 200 });
    expect(DEFAULT_SCORING_TABLE[19]).toEqual({ position: 20, points: 1 });
  });

  it('formats sequential edition names', () => {
    expect(formatEditionName(3)).toBe('Clandestino #3');
  });

  it('accepts explicit draw configuration', () => {
    expect(
      Value.Check(ExecuteDrawBodySchema, {
        groupCount: 2,
        groupSizes: [3, 3],
        seedPlayerIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
        randomSeed: 'seed-1',
      }),
    ).toBe(true);
  });
});
