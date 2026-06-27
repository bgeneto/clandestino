import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

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

export const MatchParticipantSchema = Type.Object(
  {
    playerId: UuidSchema,
    setsWon: Type.Integer({ minimum: 0 }),
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
    bestOf: Type.Union([Type.Literal(3), Type.Literal(5)]),
    participants: Type.Array(MatchParticipantSchema, { minItems: 2, maxItems: 2 }),
    resultSubmittedByPlayerId: Type.Optional(UuidSchema),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  },
  { $id: 'Match' },
);

export type Match = Static<typeof MatchSchema>;

export const SubmitMatchResultBodySchema = Type.Object(
  {
    setsWonByReporter: Type.Integer({ minimum: 0 }),
    setsWonByOpponent: Type.Integer({ minimum: 0 }),
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
    setsWonByPlayerOne: Type.Integer({ minimum: 0 }),
    setsWonByPlayerTwo: Type.Integer({ minimum: 0 }),
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
