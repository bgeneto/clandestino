import { type Static, Type } from '@sinclair/typebox';
import { IsoDateTimeSchema } from './common.js';

export const RequestOrganizerMagicLinkBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', minLength: 3, maxLength: 254 }),
  },
  { $id: 'RequestOrganizerMagicLinkBody' },
);

export type RequestOrganizerMagicLinkBody = Static<typeof RequestOrganizerMagicLinkBodySchema>;

export const RequestOrganizerMagicLinkResponseSchema = Type.Object(
  {
    message: Type.String(),
    expiresInMinutes: Type.Integer({ minimum: 1 }),
    magicLink: Type.Optional(Type.String()),
  },
  { $id: 'RequestOrganizerMagicLinkResponse' },
);

export type RequestOrganizerMagicLinkResponse = Static<
  typeof RequestOrganizerMagicLinkResponseSchema
>;

export const VerifyOrganizerMagicLinkBodySchema = Type.Object(
  {
    token: Type.String({ minLength: 32, maxLength: 128 }),
  },
  { $id: 'VerifyOrganizerMagicLinkBody' },
);

export type VerifyOrganizerMagicLinkBody = Static<typeof VerifyOrganizerMagicLinkBodySchema>;

export const OrganizerSessionResponseSchema = Type.Object(
  {
    sessionToken: Type.String({ minLength: 32 }),
    email: Type.String({ format: 'email' }),
    expiresAt: IsoDateTimeSchema,
  },
  { $id: 'OrganizerSessionResponse' },
);

export type OrganizerSessionResponse = Static<typeof OrganizerSessionResponseSchema>;

export const OrganizerSessionStatusSchema = Type.Object(
  {
    email: Type.String({ format: 'email' }),
    expiresAt: IsoDateTimeSchema,
  },
  { $id: 'OrganizerSessionStatus' },
);

export type OrganizerSessionStatus = Static<typeof OrganizerSessionStatusSchema>;
