import { FormatRegistry } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

FormatRegistry.Set('uuid', (value) => typeof value === 'string' && UUID_PATTERN.test(value));
FormatRegistry.Set('date', (value) => typeof value === 'string' && ISO_DATE_PATTERN.test(value));
FormatRegistry.Set(
  'date-time',
  (value) => typeof value === 'string' && ISO_DATE_TIME_PATTERN.test(value),
);
FormatRegistry.Set(
  'email',
  (value) =>
    typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254,
);

export const UuidSchema = Type.String({ format: 'uuid' });

export const IsoDateTimeSchema = Type.String({ format: 'date-time' });

export const IsoDateSchema = Type.String({ format: 'date' });

export const JsonValueSchema = Type.Recursive((self) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(self),
    Type.Record(Type.String(), self),
  ]),
);
