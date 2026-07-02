import { type Static, Type } from '@sinclair/typebox';
import { UuidSchema } from './common.js';

export const MatchOutcomeSchema = Type.Union([Type.Literal('PLAYED'), Type.Literal('WALKOVER')], {
  $id: 'MatchOutcome',
});

export type MatchOutcome = Static<typeof MatchOutcomeSchema>;

export const BracketRoundSchema = Type.Union(
  [Type.Literal('SEMIFINAL'), Type.Literal('FINAL'), Type.Literal('THIRD_PLACE')],
  { $id: 'BracketRound' },
);

export type BracketRound = Static<typeof BracketRoundSchema>;

export const PlacementFormatSchema = Type.Union(
  [Type.Literal('round-robin'), Type.Literal('knockout'), Type.Literal('bracket-4')],
  { $id: 'PlacementFormat' },
);

export type PlacementFormat = Static<typeof PlacementFormatSchema>;

export const WithdrawPlayerBodySchema = Type.Object(
  {
    playerId: UuidSchema,
  },
  { $id: 'WithdrawPlayerBody' },
);

export type WithdrawPlayerBody = Static<typeof WithdrawPlayerBodySchema>;

export const WithdrawPlayerResponseSchema = Type.Object(
  {
    playerId: UuidSchema,
    withdrawnAt: Type.String({ format: 'date-time' }),
    withdrawnDuringPhase: Type.Union([
      Type.Literal('GROUP_STAGE'),
      Type.Literal('PLACEMENT_STAGE'),
    ]),
  },
  { $id: 'WithdrawPlayerResponse' },
);

export type WithdrawPlayerResponse = Static<typeof WithdrawPlayerResponseSchema>;
