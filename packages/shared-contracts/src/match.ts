import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';
import { BracketRoundSchema, MatchOutcomeSchema } from './placement.js';

/**
 * Maximum sets either player can have in a played match.
 * High enough for best-of-7 terminal scores (4×3) without locking a format;
 * rejects absurd tallies such as 7×2.
 */
export const MAX_SETS_SCORE = 4;

/** Minimum sets the winner must have in a played match (rejects incomplete 1×0). */
export const MIN_WINNER_SETS = 2;

export const MatchStatusSchema = Type.Union(
  [
    Type.Literal('AGENDADA'),
    Type.Literal('AGUARDANDO_CONFIRMACAO'),
    Type.Literal('CONFIRMADA'),
    Type.Literal('CONTESTADA'),
    Type.Literal('CORRIGIDA'),
    Type.Literal('CANCELADA'),
  ],
  { $id: 'MatchStatus' },
);

export type MatchStatus = Static<typeof MatchStatusSchema>;

/** Mirrors isGroupStageComplete — a match is settled for edition close purposes. */
export function isMatchResolvedForEditionClose(status: MatchStatus): boolean {
  return status === 'CONFIRMADA' || status === 'CORRIGIDA' || status === 'CANCELADA';
}

export const MatchParticipantSchema = Type.Object(
  {
    playerId: UuidSchema,
    setsWon: Type.Integer({ minimum: 0, maximum: MAX_SETS_SCORE }),
  },
  { $id: 'MatchParticipant' },
);

export type MatchParticipant = Static<typeof MatchParticipantSchema>;

export const MatchSchema = Type.Object(
  {
    id: UuidSchema,
    editionId: UuidSchema,
    groupId: UuidSchema,
    status: MatchStatusSchema,
    participants: Type.Array(MatchParticipantSchema, { minItems: 2, maxItems: 2 }),
    outcome: MatchOutcomeSchema,
    bracketRound: Type.Optional(BracketRoundSchema),
    walkoverAbsentPlayerId: Type.Optional(UuidSchema),
    resultSubmittedByPlayerId: Type.Optional(UuidSchema),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { $id: 'Match' },
);

export type Match = Static<typeof MatchSchema>;

export const SubmitMatchResultBodySchema = Type.Object(
  {
    outcome: Type.Optional(MatchOutcomeSchema),
    absentPlayerId: Type.Optional(UuidSchema),
    setsWonByReporter: Type.Optional(Type.Integer({ minimum: 0, maximum: MAX_SETS_SCORE })),
    setsWonByOpponent: Type.Optional(Type.Integer({ minimum: 0, maximum: MAX_SETS_SCORE })),
  },
  { $id: 'SubmitMatchResultBody' },
);

export type SubmitMatchResultBody = Static<typeof SubmitMatchResultBodySchema>;

export const MatchResultResponseSchema = Type.Object(
  {
    match: MatchSchema,
  },
  { $id: 'MatchResultResponse' },
);

export type MatchResultResponse = Static<typeof MatchResultResponseSchema>;

export const PlayerMatchesResponseSchema = Type.Object(
  {
    matches: Type.Array(MatchSchema),
  },
  { $id: 'PlayerMatchesResponse' },
);

export type PlayerMatchesResponse = Static<typeof PlayerMatchesResponseSchema>;

export const EditionMatchesResponseSchema = Type.Object(
  {
    matches: Type.Array(MatchSchema),
  },
  { $id: 'EditionMatchesResponse' },
);

export type EditionMatchesResponse = Static<typeof EditionMatchesResponseSchema>;

export const ContestMatchBodySchema = Type.Object(
  {
    reason: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { $id: 'ContestMatchBody' },
);

export type ContestMatchBody = Static<typeof ContestMatchBodySchema>;

export const CorrectMatchResultBodySchema = Type.Object(
  {
    outcome: Type.Optional(MatchOutcomeSchema),
    absentPlayerId: Type.Optional(UuidSchema),
    setsWonByPlayerOne: Type.Optional(Type.Integer({ minimum: 0, maximum: MAX_SETS_SCORE })),
    setsWonByPlayerTwo: Type.Optional(Type.Integer({ minimum: 0, maximum: MAX_SETS_SCORE })),
  },
  { $id: 'CorrectMatchResultBody' },
);

export type CorrectMatchResultBody = Static<typeof CorrectMatchResultBodySchema>;

export const ContestedMatchSchema = Type.Object(
  {
    match: MatchSchema,
    contestReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { $id: 'ContestedMatch' },
);

export type ContestedMatch = Static<typeof ContestedMatchSchema>;

export const EditionContestedMatchesResponseSchema = Type.Object(
  {
    contests: Type.Array(ContestedMatchSchema),
  },
  { $id: 'EditionContestedMatchesResponse' },
);

export type EditionContestedMatchesResponse = Static<typeof EditionContestedMatchesResponseSchema>;
