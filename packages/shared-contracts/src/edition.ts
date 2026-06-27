import { type Static, Type } from '@sinclair/typebox';
import { IsoDateSchema, IsoDateTimeSchema, UuidSchema } from './common.js';
import { TournamentRulesSchema } from './tournament-rules.js';

export const EditionStatusSchema = Type.Union(
  [
    Type.Literal('RASCUNHO'),
    Type.Literal('INSCRICOES_ABERTAS'),
    Type.Literal('SORTEIO_PUBLICADO'),
    Type.Literal('EM_ANDAMENTO'),
    Type.Literal('FASE_COLOCACAO'),
    Type.Literal('ENCERRADA'),
  ],
  { $id: 'EditionStatus' },
);

export type EditionStatus = Static<typeof EditionStatusSchema>;

export const EditionSchema = Type.Object(
  {
    id: UuidSchema,
    seasonId: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    date: IsoDateSchema,
    rules: TournamentRulesSchema,
    status: EditionStatusSchema,
    autoConfirmMinutes: Type.Integer({ minimum: 1 }),
    createdAt: IsoDateTimeSchema,
  },
  { $id: 'Edition' },
);

export type Edition = Static<typeof EditionSchema>;

export const CreateEditionBodySchema = Type.Object(
  {
    seasonId: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    date: IsoDateSchema,
    rules: Type.Optional(TournamentRulesSchema),
    autoConfirmMinutes: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { $id: 'CreateEditionBody' },
);

export type CreateEditionBody = Static<typeof CreateEditionBodySchema>;

export const EditionRegistrationSchema = Type.Object(
  {
    editionId: UuidSchema,
    playerId: UuidSchema,
    registeredAt: IsoDateTimeSchema,
  },
  { $id: 'EditionRegistration' },
);

export type EditionRegistration = Static<typeof EditionRegistrationSchema>;

export const RegisterPlayerBodySchema = Type.Object(
  {
    playerId: UuidSchema,
  },
  { $id: 'RegisterPlayerBody' },
);

export type RegisterPlayerBody = Static<typeof RegisterPlayerBodySchema>;

export const EditionRegistrationsResponseSchema = Type.Object(
  {
    registrations: Type.Array(EditionRegistrationSchema),
  },
  { $id: 'EditionRegistrationsResponse' },
);

export type EditionRegistrationsResponse = Static<typeof EditionRegistrationsResponseSchema>;
